import { Queue, type QueueOptions } from "bullmq";

import { GAP_DETECTION_QUEUE, GAP_DETECTION_REPEAT_PATTERN } from "../gapDetectorWorker";

import {
  QUEUE_NAMES,
  JOB_NAMES,
  DEFAULT_JOB_OPTIONS,
  type CollectOHLCVJobData,
  type BackfillJobData,
  type DetectGapsJobData,
  type ExportJobData,
} from "./types";

export interface SchedulerConfig {
  redisConnection: { host: string; port: number };
}

export function createQueues(config: SchedulerConfig) {
  const queueOpts: QueueOptions = {
    connection: config.redisConnection,
  };

  const collectionQueue = new Queue<CollectOHLCVJobData>(QUEUE_NAMES.DATA_COLLECTION, queueOpts);
  const backfillQueue = new Queue<BackfillJobData>(QUEUE_NAMES.DATA_BACKFILL, queueOpts);
  const exportQueue = new Queue<ExportJobData>(QUEUE_NAMES.DATA_EXPORT, queueOpts);
  const gapDetectionQueue = new Queue(GAP_DETECTION_QUEUE, queueOpts);

  return { collectionQueue, backfillQueue, exportQueue, gapDetectionQueue };
}

export async function setupGapDetectionJob(gapDetectionQueue: Queue) {
  await gapDetectionQueue.add(
    "detect-all-gaps",
    {},
    {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { pattern: GAP_DETECTION_REPEAT_PATTERN },
      jobId: "detect-all-gaps-recurring",
      priority: 3,
    }
  );
}

export async function setupRepeatableJobs(
  collectionQueue: Queue<CollectOHLCVJobData>,
  pairs: string[],
  exchanges: string[]
) {
  // collect-ohlcv-1m: every 1 minute for each exchange/pair
  for (const exchange of exchanges) {
    for (const symbol of pairs) {
      await collectionQueue.add(
        JOB_NAMES.COLLECT_OHLCV_1M,
        { exchange, symbol, timeframe: "1m" },
        {
          ...DEFAULT_JOB_OPTIONS,
          repeat: { every: 60_000 },
          jobId: `collect-1m-${exchange}-${symbol.replace("/", "-")}`,
          priority: 1,
        }
      );
    }
  }

  // collect-ohlcv-1h: every 1 hour
  for (const exchange of exchanges) {
    for (const symbol of pairs) {
      for (const tf of ["1h", "4h", "1d"] as const) {
        await collectionQueue.add(
          JOB_NAMES.COLLECT_OHLCV_1H,
          { exchange, symbol, timeframe: tf },
          {
            ...DEFAULT_JOB_OPTIONS,
            repeat: { every: 3_600_000 },
            jobId: `collect-${tf}-${exchange}-${symbol.replace("/", "-")}`,
            priority: 2,
          }
        );
      }
    }
  }
}

export async function addDetectGapsJob(
  collectionQueue: Queue,
  exchange: string,
  symbol: string,
  timeframe: string
) {
  await collectionQueue.add(
    JOB_NAMES.DETECT_GAPS,
    { exchange, symbol, timeframe } satisfies DetectGapsJobData,
    {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { every: 6 * 3_600_000 },
      jobId: `detect-gaps-${exchange}-${symbol.replace("/", "-")}-${timeframe}`,
      priority: 3,
    }
  );
}

export async function addBackfillJob(backfillQueue: Queue<BackfillJobData>, data: BackfillJobData) {
  await backfillQueue.add(JOB_NAMES.BACKFILL, data, {
    ...DEFAULT_JOB_OPTIONS,
    priority: 3,
    jobId: `backfill-${data.exchange}-${data.symbol.replace("/", "-")}-${data.timeframe}-${data.startTime}`,
  });
}

export async function addExportJob(exportQueue: Queue<ExportJobData>, data: ExportJobData) {
  await exportQueue.add(JOB_NAMES.EXPORT_DATA, data, {
    ...DEFAULT_JOB_OPTIONS,
    priority: 4,
  });
}
