import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  CompressionHelper,
  CSVExporter,
  ParquetExporter,
  QUEUE_NAMES,
  SQLiteExporter,
  type ExportJobData,
} from "@tb/data-pipeline";
import { dataExports, type Database, type OHLCVRow } from "@tb/db";
import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import type IORedis from "ioredis";

import type { MarketDataReader, MarketCandle } from "../services/harvesterMarketData";
import { uniqueNormalizedSymbols } from "../utils/symbols";

export async function createDataPipelineWorkers(options: {
  db: Database;
  redis: IORedis;
  exportsDir: string;
  marketData: MarketDataReader;
}) {
  const redisConnection = {
    host: options.redis.options.host ?? "127.0.0.1",
    port: options.redis.options.port ?? 6379,
  };

  // Trading bot platform does not collect or backfill market data. Signal Harvester
  // owns ingestion and writes market candles to the configured database; this worker
  // only handles platform-local export jobs.
  const exportWorker = createMarketDataExportWorker({
    db: options.db,
    marketData: options.marketData,
    redisConnection,
  });

  exportWorker.on("completed", async (job) => {
    try {
      await options.redis.publish(
        "data:status",
        JSON.stringify({
          exportId: job?.data?.exportId,
          status: "completed",
          lastUpdated: Date.now(),
        })
      );
    } catch (error) {
      console.error("Failed to publish data-export completion", error);
    }
  });
  exportWorker.on("failed", async (job, error) => {
    try {
      await options.redis.publish(
        "worker:error",
        JSON.stringify({
          scope: "data-export",
          exportId: job?.data?.exportId,
          message: error.message,
          timestamp: Date.now(),
        })
      );
    } catch (publishError) {
      console.error("Failed to publish data-export failure", publishError);
    }
  });

  return { exportWorker };
}

function createMarketDataExportWorker(config: {
  db: Database;
  marketData: MarketDataReader;
  redisConnection: { host: string; port: number };
}) {
  return new Worker<ExportJobData>(
    QUEUE_NAMES.DATA_EXPORT,
    async (job: Job<ExportJobData>) => runMarketDataExport(config.db, config.marketData, job.data),
    {
      connection: config.redisConnection,
      concurrency: 1,
    }
  );
}

export async function runMarketDataExport(
  db: Database,
  marketData: MarketDataReader,
  data: ExportJobData
): Promise<{ filePath: string; fileSize: number; rowCount: number }> {
  await updateExportStatus(db, data.exportId, "processing", 0);
  await mkdir(data.outputDir, { recursive: true });

  const extension = data.format === "sqlite" ? "sqlite" : data.format;
  const outputPath = join(data.outputDir, `${data.exportId}.${extension}`);
  let rowCount = 0;

  try {
    if (data.format === "csv") {
      const exporter = new CSVExporter();
      exporter.open(outputPath);
      for await (const rows of streamExportRows(marketData, data, (progress) =>
        updateExportStatus(db, data.exportId, "processing", progress)
      )) {
        exporter.appendBatch(rows);
        rowCount += rows.length;
      }
      rowCount = (await exporter.close()).rowCount;
    } else if (data.format === "parquet") {
      const exporter = new ParquetExporter();
      rowCount = (
        await exporter.export(
          flattenExportRows(marketData, data, (progress) =>
            updateExportStatus(db, data.exportId, "processing", progress)
          ),
          outputPath
        )
      ).rowCount;
    } else {
      const exporter = new SQLiteExporter();
      exporter.open(outputPath);
      for await (const rows of streamExportRows(marketData, data, (progress) =>
        updateExportStatus(db, data.exportId, "processing", progress)
      )) {
        exporter.appendBatch(rows);
        rowCount += rows.length;
      }
      rowCount = exporter.close().rowCount;
    }

    await updateExportStatus(db, data.exportId, "processing", 80);
    const finalPath =
      data.compressed && data.format !== "sqlite"
        ? await CompressionHelper.compress(outputPath, data.compressionFormat)
        : outputPath;
    const fileStat = await stat(finalPath);
    await updateExportStatus(db, data.exportId, "completed", 100, {
      filePath: finalPath,
      fileSize: fileStat.size,
      rowCount,
    });
    return { filePath: finalPath, fileSize: fileStat.size, rowCount };
  } catch (error) {
    await updateExportStatus(db, data.exportId, "failed", 0, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function* streamExportRows(
  marketData: MarketDataReader,
  data: ExportJobData,
  onProgress?: (progress: number) => Promise<void>
): AsyncIterable<OHLCVRow[]> {
  const symbols = uniqueNormalizedSymbols(data.symbols);
  if (symbols.length === 0) {
    throw new Error("Market data export requires at least one symbol");
  }

  for (let index = 0; index < symbols.length; index++) {
    const symbol = symbols[index]!;
    for await (const batch of marketData.streamCandles(
      {
        exchange: data.exchange,
        symbol,
        timeframe: data.timeframe,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      },
      10_000
    )) {
      yield batch.map(toOHLCVRow);
    }

    const progress = Math.round(((index + 1) / symbols.length) * 70);
    await onProgress?.(progress);
  }
}

async function* flattenExportRows(
  marketData: MarketDataReader,
  data: ExportJobData,
  onProgress?: (progress: number) => Promise<void>
): AsyncIterable<OHLCVRow> {
  for await (const batch of streamExportRows(marketData, data, onProgress)) {
    yield* batch;
  }
}

function toOHLCVRow(row: MarketCandle): OHLCVRow {
  return {
    time: row.time,
    exchange: row.exchange,
    symbol: row.symbol,
    timeframe: row.timeframe,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    tradesCount: row.tradesCount ?? null,
    source: "signal-harvester",
    provisional: false,
    closed: true,
    repaired: false,
    exchangeVerified: true,
    createdAt: null,
  };
}

async function updateExportStatus(
  db: Database,
  id: string,
  status: string,
  progress: number,
  extra?: { filePath?: string; fileSize?: number; rowCount?: number; error?: string }
) {
  await db
    .update(dataExports)
    .set({
      status,
      progress,
      filePath: extra?.filePath,
      fileSize: extra?.fileSize,
      rowCount: extra?.rowCount,
      error: extra?.error,
      completedAt: status === "completed" || status === "failed" ? new Date() : undefined,
    })
    .where(eq(dataExports.id, id));
}
