import { Queue } from "bullmq";
import type IORedis from "ioredis";

import { API_QUEUE_NAMES, type BacktestJobData, type BotJobData } from "./types.js";

export interface QueueSet {
  botExecutionQueue: Queue<BotJobData>;
  backtestQueue: Queue<BacktestJobData>;
  dataCollectionQueue: Queue;
  dataBackfillQueue: Queue;
  dataExportQueue: Queue;
  close: () => Promise<void>;
}

export function createQueueSet(redis: IORedis): QueueSet {
  const connection = redis.duplicate({ maxRetriesPerRequest: null });
  const botExecutionQueue = new Queue<BotJobData>(API_QUEUE_NAMES.BOT_EXECUTION, { connection });
  const backtestQueue = new Queue<BacktestJobData>(API_QUEUE_NAMES.BACKTEST, { connection });
  const dataCollectionQueue = new Queue(API_QUEUE_NAMES.DATA_COLLECTION, { connection });
  const dataBackfillQueue = new Queue(API_QUEUE_NAMES.DATA_BACKFILL, { connection });
  const dataExportQueue = new Queue(API_QUEUE_NAMES.DATA_EXPORT, { connection });

  return {
    botExecutionQueue,
    backtestQueue,
    dataCollectionQueue,
    dataBackfillQueue,
    dataExportQueue,
    close: async () => {
      await Promise.allSettled([
        botExecutionQueue.close(),
        backtestQueue.close(),
        dataCollectionQueue.close(),
        dataBackfillQueue.close(),
        dataExportQueue.close(),
      ]);

      await connection.quit();
    },
  };
}
