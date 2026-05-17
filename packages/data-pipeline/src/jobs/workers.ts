import type { Database } from "@tb/db";
import { Queue, Worker, type Job } from "bullmq";

import { BackfillManager } from "../backfill/BackfillManager";
import { planHistoricalBackfill } from "../backfill/HistoricalBackfillPlanner";
import { DataCollector } from "../collection/DataCollector";
import { ExportManager } from "../export/ExportManager";
import { ExchangeRateLimiter } from "../rateLimit/ExchangeRateLimiter";
import { RepairManager } from "../repair/RepairManager";
import { GapDetector } from "../validation/GapDetector";

import {
  QUEUE_NAMES,
  JOB_NAMES,
  type CollectOHLCVJobData,
  type BackfillJobData,
  type DetectGapsJobData,
  type HistoricalBackfillJobData,
  type RepairJobData,
  type ExportJobData,
} from "./types";

const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

export interface WorkerConfig {
  db: Database;
  redisConnection: { host: string; port: number };
  exportDir: string;
}

export function createCollectionWorker(config: WorkerConfig) {
  const rateLimiter = new ExchangeRateLimiter();
  const collector = new DataCollector(config.db, rateLimiter);
  const gapDetector = new GapDetector(config.db);
  const repairManager = new RepairManager(config.db);
  const backfillQueue = new Queue<BackfillJobData>(QUEUE_NAMES.DATA_BACKFILL, {
    connection: config.redisConnection,
  });

  return new Worker(
    QUEUE_NAMES.DATA_COLLECTION,
    async (job: Job<CollectOHLCVJobData | DetectGapsJobData | RepairJobData>) => {
      if (
        job.name === JOB_NAMES.COLLECT_OHLCV_1M ||
        job.name === JOB_NAMES.COLLECT_OHLCV_1H ||
        job.name === JOB_NAMES.COLLECT_OHLCV_DAILY
      ) {
        const data = job.data as CollectOHLCVJobData;
        return collector.collectOHLCV(data.exchange, data.symbol, data.timeframe);
      }

      if (job.name === JOB_NAMES.REPAIR_RECENT) {
        const data = job.data as RepairJobData;
        const result = await repairManager.repairRecent(data);
        const timeframeMs = TIMEFRAME_MS[data.timeframe] ?? 60_000;

        for (const gap of result.gaps.slice(0, 10)) {
          const startTime = gap.start.toISOString();
          const endTime = new Date(gap.end.getTime() + timeframeMs).toISOString();
          await backfillQueue.add(
            JOB_NAMES.BACKFILL,
            {
              exchange: data.exchange,
              symbol: data.symbol,
              timeframe: data.timeframe,
              startTime,
              endTime,
              reason: "gap-repair",
              priority: 2,
            },
            {
              attempts: 5,
              backoff: { type: "exponential", delay: 2000 },
              priority: 2,
              jobId: `gap-repair-${data.exchange}-${data.symbol.replace("/", "-")}-${data.timeframe}-${startTime}`,
              removeOnComplete: { age: 86400 },
              removeOnFail: { age: 604800 },
            }
          );
        }

        return { ...result, queuedGapRepairs: Math.min(result.gaps.length, 10) };
      }

      if (job.name === JOB_NAMES.DETECT_GAPS) {
        const data = job.data as DetectGapsJobData;
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60_000); // Last 30 days
        const gaps = await gapDetector.detectGaps(
          data.exchange,
          data.symbol,
          data.timeframe,
          startTime,
          endTime
        );
        await gapDetector.updateGapCount(
          data.exchange,
          data.symbol,
          data.timeframe,
          gaps.reduce((sum, g) => sum + g.missingCount, 0)
        );
        return { gaps: gaps.length, totalMissing: gaps.reduce((s, g) => s + g.missingCount, 0) };
      }
    },
    {
      connection: config.redisConnection,
      concurrency: 5,
    }
  );
}

export function createBackfillWorker(config: WorkerConfig) {
  const rateLimiter = new ExchangeRateLimiter();
  const manager = new BackfillManager(config.db, rateLimiter);
  const backfillQueue = new Queue<BackfillJobData>(QUEUE_NAMES.DATA_BACKFILL, {
    connection: config.redisConnection,
  });

  return new Worker<BackfillJobData | HistoricalBackfillJobData>(
    QUEUE_NAMES.DATA_BACKFILL,
    async (job: Job<BackfillJobData | HistoricalBackfillJobData>) => {
      if (job.name === JOB_NAMES.BACKFILL_HISTORY) {
        const data = job.data as HistoricalBackfillJobData;
        return planHistoricalBackfill(config.db, backfillQueue, data);
      }

      const data = job.data as BackfillJobData;
      const jobConfig = await manager.createBackfillJob(
        data.exchange,
        data.symbol,
        data.timeframe,
        new Date(data.startTime),
        new Date(data.endTime)
      );
      return manager.runBackfill(jobConfig);
    },
    {
      connection: config.redisConnection,
      // One backfill request stream at a time. Live/recent collection runs on its
      // own queue, and this low concurrency keeps Binance headroom available.
      concurrency: 1,
    }
  );
}

export function createExportWorker(config: WorkerConfig) {
  const exportManager = new ExportManager(config.db);

  return new Worker<ExportJobData>(
    QUEUE_NAMES.DATA_EXPORT,
    async (job: Job<ExportJobData>) => {
      const data = job.data;
      return exportManager.runExport({
        id: data.exportId,
        exchange: data.exchange,
        symbols: data.symbols,
        timeframe: data.timeframe,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        format: data.format,
        compressed: data.compressed,
        compressionFormat: data.compressionFormat,
        outputDir: data.outputDir,
      });
    },
    {
      connection: config.redisConnection,
      concurrency: 1,
    }
  );
}
