import {
  createCollectionWorker,
  createBackfillWorker,
  createExportWorker,
} from "@tb/data-pipeline";
import type { Database } from "@tb/db";
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
