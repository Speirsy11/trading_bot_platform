import {
  createCollectionWorker,
  createBackfillWorker,
  createExportWorker,
} from "@tb/data-pipeline";
import type { Database } from "@tb/db";
import type IORedis from "ioredis";

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
  });
  collectionWorker.on("failed", async (job, error) => {
    await options.redis.publish(
      "worker:error",
      JSON.stringify({
        scope: "data-collection",
        jobId: job?.id,
        message: error.message,
        timestamp: Date.now(),
      })
    );
  });
  backfillWorker.on("failed", async (job, error) => {
    await options.redis.publish(
      "worker:error",
      JSON.stringify({
        scope: "data-backfill",
        jobId: job?.id,
        message: error.message,
        timestamp: Date.now(),
      })
    );
  });
  exportWorker.on("completed", async (job) => {
    await options.redis.publish(
      "data:status",
      JSON.stringify({ exportId: job.data.exportId, status: "completed", lastUpdated: Date.now() })
    );
  });
  exportWorker.on("failed", async (job, error) => {
    await options.redis.publish(
      "worker:error",
      JSON.stringify({
        scope: "data-export",
        exportId: job?.data.exportId,
        message: error.message,
        timestamp: Date.now(),
      })
    );
  });

  return {
    collectionWorker,
    backfillWorker,
    exportWorker,
  };
}
