import {
  createBackfillWorker,
  createCollectionWorker,
  createExportWorker,
  QUEUE_NAMES,
  setupHistoricalBackfillJob,
  setupRepeatableJobs,
  type BackfillJobData,
  type HistoricalBackfillJobData,
} from "@tb/data-pipeline";
import type { Database } from "@tb/db";
import { Queue } from "bullmq";
import type IORedis from "ioredis";

export async function createDataPipelineWorkers(options: {
  db: Database;
  redis: IORedis;
  exportsDir: string;
  collectionConfig: {
    exchanges: string[];
    pairs: string[];
    timeframes: string[];
  };
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
  const collectionQueue = new Queue(QUEUE_NAMES.DATA_COLLECTION, { connection: redisConnection });
  const backfillQueue = new Queue<BackfillJobData | HistoricalBackfillJobData>(
    QUEUE_NAMES.DATA_BACKFILL,
    { connection: redisConnection }
  );

  await setupRepeatableJobs(
    collectionQueue,
    options.collectionConfig.pairs,
    options.collectionConfig.exchanges,
    options.collectionConfig.timeframes
  );
  await setupHistoricalBackfillJob(backfillQueue, {
    exchanges: options.collectionConfig.exchanges,
    symbols: options.collectionConfig.pairs,
    timeframes: options.collectionConfig.timeframes,
    maxChunksPerRun: 3,
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

  return { collectionWorker, backfillWorker, exportWorker, collectionQueue, backfillQueue };
}
