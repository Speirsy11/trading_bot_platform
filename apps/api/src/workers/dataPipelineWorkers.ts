import {
  createCollectionWorker,
  createBackfillWorker,
  createExportWorker,
  WebSocketManager,
} from "@tb/data-pipeline";
import { dataCollectionStatus, ohlcv, upsertOHLCV, type Database } from "@tb/db";
import { sql } from "drizzle-orm";
import type IORedis from "ioredis";

import {
  ohlcvCandlesCollected,
  ohlcvCollectionDuration,
  ohlcvCollectionErrors,
} from "../utils/metrics";

export function createDataPipelineWorkers(options: {
  db: Database;
  redis: IORedis;
  exportsDir: string;
}) {
  const redisConnection = {
    host: options.redis.options.host ?? "127.0.0.1",
    port: options.redis.options.port ?? 6379,
  };

  const collectionWorker = createCollectionWorker({
    db: options.db,
    redisConnection,
    exportDir: options.exportsDir,
  });
  const backfillWorker = createBackfillWorker({
    db: options.db,
    redisConnection,
    exportDir: options.exportsDir,
  });
  const exportWorker = createExportWorker({
    db: options.db,
    redisConnection,
    exportDir: options.exportsDir,
  });

  collectionWorker.on("completed", async (job, result) => {
    const duration = (job.finishedOn ?? Date.now()) - (job.processedOn ?? Date.now());
    ohlcvCandlesCollected.inc(
      { exchange: job.data.exchange, symbol: job.data.symbol, timeframe: job.data.timeframe },
      result.inserted
    );
    ohlcvCollectionDuration.observe({ exchange: job.data.exchange }, duration);
    try {
      await options.redis.publish(
        "data:status",
        JSON.stringify({
          exchange: job.data.exchange,
          symbol: job.data.symbol,
          timeframe: job.data.timeframe,
          status: "idle",
          result,
          lastUpdated: Date.now(),
        })
      );
    } catch (error) {
      console.error("Failed to publish data-collection completion", error);
    }
  });
  collectionWorker.on("failed", async (job, error) => {
    if (job) {
      ohlcvCollectionErrors.inc({
        exchange: job.data.exchange,
        symbol: job.data.symbol,
        timeframe: job.data.timeframe,
      });
    }
    try {
      await options.redis.publish(
        "worker:error",
        JSON.stringify({
          scope: "data-collection",
          jobId: job?.id,
          message: error.message,
          timestamp: Date.now(),
        })
      );
    } catch (publishError) {
      console.error("Failed to publish data-collection failure", publishError);
    }
  });
  backfillWorker.on("failed", async (job, error) => {
    try {
      await options.redis.publish(
        "worker:error",
        JSON.stringify({
          scope: "data-backfill",
          jobId: job?.id,
          message: error.message,
          timestamp: Date.now(),
        })
      );
    } catch (publishError) {
      console.error("Failed to publish data-backfill failure", publishError);
    }
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

  return {
    collectionWorker,
    backfillWorker,
    exportWorker,
  };
}

interface LiveCollectorConfig {
  exchanges: string[];
  pairs: string[];
  timeframes: string[];
}

interface LiveCandleEvent {
  exchange: string;
  symbol: string;
  timeframe: string;
  candle: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

async function refreshLiveStats(db: Database, exchange: string, symbol: string, timeframe: string) {
  await db
    .insert(dataCollectionStatus)
    .values({ exchange, symbol, timeframe, status: "streaming", lastCollectedAt: new Date() })
    .onConflictDoUpdate({
      target: [
        dataCollectionStatus.exchange,
        dataCollectionStatus.symbol,
        dataCollectionStatus.timeframe,
      ],
      set: {
        status: "streaming",
        lastCollectedAt: sql`NOW()`,
        earliest: sql`(SELECT MIN(${ohlcv.time}) FROM ${ohlcv} WHERE ${ohlcv.exchange} = ${exchange} AND ${ohlcv.symbol} = ${symbol} AND ${ohlcv.timeframe} = ${timeframe})`,
        latest: sql`(SELECT MAX(${ohlcv.time}) FROM ${ohlcv} WHERE ${ohlcv.exchange} = ${exchange} AND ${ohlcv.symbol} = ${symbol} AND ${ohlcv.timeframe} = ${timeframe})`,
        totalCandles: sql`(SELECT COUNT(*) FROM ${ohlcv} WHERE ${ohlcv.exchange} = ${exchange} AND ${ohlcv.symbol} = ${symbol} AND ${ohlcv.timeframe} = ${timeframe})`,
        errorMessage: null,
        updatedAt: sql`NOW()`,
      },
    });
}

export async function startLiveMarketDataCollector(options: {
  db: Database;
  redis: IORedis;
  config: LiveCollectorConfig;
}) {
  const manager = new WebSocketManager();

  manager.on("candle", (event: LiveCandleEvent) => {
    void (async () => {
      const { exchange, symbol, timeframe, candle } = event;
      await upsertOHLCV(options.db, [
        {
          exchange,
          symbol,
          timeframe,
          time: new Date(candle.time),
          open: String(candle.open),
          high: String(candle.high),
          low: String(candle.low),
          close: String(candle.close),
          volume: String(candle.volume),
        },
      ]);
      await refreshLiveStats(options.db, exchange, symbol, timeframe);
      await options.redis.publish(
        "data:status",
        JSON.stringify({
          exchange,
          symbol,
          timeframe,
          status: "streaming",
          source: "websocket",
          lastUpdated: Date.now(),
        })
      );
    })().catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      await options.redis.publish(
        "worker:error",
        JSON.stringify({ scope: "live-market-data", message, timestamp: Date.now() })
      );
    });
  });

  for (const exchange of options.config.exchanges) {
    for (const symbol of options.config.pairs) {
      for (const timeframe of options.config.timeframes) {
        try {
          await manager.subscribe({ exchange, symbol, timeframe });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await options.redis.publish(
            "worker:error",
            JSON.stringify({
              scope: "live-market-data-subscribe",
              exchange,
              symbol,
              timeframe,
              message,
              timestamp: Date.now(),
            })
          );
        }
      }
    }
  }

  return manager;
}
