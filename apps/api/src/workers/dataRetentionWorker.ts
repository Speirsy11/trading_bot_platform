import type { Database } from "@tb/db";
import { Queue, Worker } from "bullmq";
import type IORedis from "ioredis";
import pino from "pino";

import { runDataRetention } from "./dataRetention";

const logger = pino({ name: "dataRetention" });

const QUEUE_NAME = "data-retention";
const JOB_NAME = "run-retention";

export function createDataRetentionWorker(options: { db: Database; redis: IORedis }) {
  const connection = options.redis.duplicate({ maxRetriesPerRequest: null });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== JOB_NAME) {
        return null;
      }

      logger.info("data retention job started");

      const result = await runDataRetention(options.db);

      logger.info(result, "data retention job completed");

      return result;
    },
    { connection }
  );

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "data retention job failed");
  });

  return worker;
}

export async function scheduleDataRetentionJob(redis: IORedis) {
  const connection = redis.duplicate({ maxRetriesPerRequest: null });
  const retentionQueue = new Queue(QUEUE_NAME, { connection });

  await retentionQueue.add(
    JOB_NAME,
    {},
    {
      repeat: { pattern: "0 3 * * *" },
      jobId: "data-retention-daily",
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );

  await retentionQueue.close();
  await connection.quit();

  logger.info("data-retention repeatable job registered (cron: 0 3 * * *)");
}
