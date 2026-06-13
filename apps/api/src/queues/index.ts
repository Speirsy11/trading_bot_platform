import { Queue } from "bullmq";
import type IORedis from "ioredis";

import {
  API_QUEUE_NAMES,
  type BacktestJobData,
  type BotJobData,
  type ResearchJobData,
} from "./types";

export interface QueueSet {
  botExecutionQueue: Queue<BotJobData>;
  backtestQueue: Queue<BacktestJobData>;
  researchQueue: Queue<ResearchJobData>;
  dataExportQueue: Queue;
  close: () => Promise<void>;
}

export function createQueueSet(redis: IORedis): QueueSet {
  const connection = redis.duplicate({ maxRetriesPerRequest: null });
  const retryDefaults = {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  } as const;
  const botExecutionQueue = new Queue<BotJobData>(API_QUEUE_NAMES.BOT_EXECUTION, {
    connection,
    defaultJobOptions: retryDefaults,
  });
  const backtestQueue = new Queue<BacktestJobData>(API_QUEUE_NAMES.BACKTEST, {
    connection,
    defaultJobOptions: retryDefaults,
  });
  const researchQueue = new Queue<ResearchJobData>(API_QUEUE_NAMES.RESEARCH, {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 20 },
    },
  });
  const dataExportQueue = new Queue(API_QUEUE_NAMES.DATA_EXPORT, { connection });

  return {
    botExecutionQueue,
    backtestQueue,
    researchQueue,
    dataExportQueue,
    close: async () => {
      await Promise.allSettled([
        botExecutionQueue.close(),
        backtestQueue.close(),
        researchQueue.close(),
        dataExportQueue.close(),
      ]);

      await connection.quit();
    },
  };
}
