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

const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

function collectJobNameForTimeframe(timeframe: string) {
  if (timeframe === "1m") return JOB_NAMES.COLLECT_OHLCV_1M;
  if (timeframe === "1d") return JOB_NAMES.COLLECT_OHLCV_DAILY;
  return JOB_NAMES.COLLECT_OHLCV_1H;
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
  exchanges: string[],
  timeframes: string[] = ["1m", "1h", "4h", "1d"]
) {
  const desiredJobIds = new Set<string>();

  // Register exactly the configured timeframes. This avoids the previous mismatch where
  // 5m/15m were seeded in settings but never scheduled for collection.
  for (const exchange of exchanges) {
    for (const symbol of pairs) {
      for (const timeframe of timeframes) {
        const intervalMs = TIMEFRAME_MS[timeframe] ?? 60_000;
        const jobId = `collect-${timeframe}-${exchange}-${symbol.replace("/", "-")}`;
        desiredJobIds.add(jobId);

        await collectionQueue.add(
          collectJobNameForTimeframe(timeframe),
          { exchange, symbol, timeframe },
          {
            ...DEFAULT_JOB_OPTIONS,
            repeat: { every: intervalMs },
            jobId,
            priority: timeframe === "1m" ? 1 : 2,
          }
        );
      }
    }
  }

  await removeUnconfiguredRepeatableCollectionJobs(collectionQueue, desiredJobIds);
}

async function removeUnconfiguredRepeatableCollectionJobs(
  collectionQueue: Queue<CollectOHLCVJobData>,
  desiredJobIds: Set<string>
) {
  const repeatableJobs = await collectionQueue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    if (!job.id?.startsWith("collect-") || desiredJobIds.has(job.id)) continue;
    await collectionQueue.removeRepeatableByKey(job.key);
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
