import type { Database } from "@tb/db";
import { Worker, type Job } from "bullmq";

import { BackfillManager } from "../backfill/BackfillManager.js";
import { DataCollector } from "../collection/DataCollector.js";
import { ExportManager } from "../export/ExportManager.js";
import { ExchangeRateLimiter } from "../rateLimit/ExchangeRateLimiter.js";
import { GapDetector } from "../validation/GapDetector.js";

import {
  QUEUE_NAMES,
  JOB_NAMES,
  type CollectOHLCVJobData,
  type BackfillJobData,
  type DetectGapsJobData,
  type ExportJobData,
} from "./types.js";

export interface WorkerConfig {
  db: Database;
  redisConnection: { host: string; port: number };
  exportDir: string;
}

export function createCollectionWorker(config: WorkerConfig) {
  const rateLimiter = new ExchangeRateLimiter();
  const collector = new DataCollector(config.db, rateLimiter);
  const gapDetector = new GapDetector(config.db);

  return new Worker(
    QUEUE_NAMES.DATA_COLLECTION,
    async (job: Job<CollectOHLCVJobData | DetectGapsJobData>) => {
      if (
        job.name === JOB_NAMES.COLLECT_OHLCV_1M ||
        job.name === JOB_NAMES.COLLECT_OHLCV_1H ||
        job.name === JOB_NAMES.COLLECT_OHLCV_DAILY
      ) {
        const data = job.data as CollectOHLCVJobData;
        return collector.collectOHLCV(data.exchange, data.symbol, data.timeframe);
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
          endTime,
        );
        await gapDetector.updateGapCount(
          data.exchange,
          data.symbol,
          data.timeframe,
          gaps.reduce((sum, g) => sum + g.missingCount, 0),
        );
        return { gaps: gaps.length, totalMissing: gaps.reduce((s, g) => s + g.missingCount, 0) };
      }
    },
    {
      connection: config.redisConnection,
      concurrency: 5,
    },
  );
}

export function createBackfillWorker(config: WorkerConfig) {
  const rateLimiter = new ExchangeRateLimiter();
  const manager = new BackfillManager(config.db, rateLimiter);

  return new Worker<BackfillJobData>(
    QUEUE_NAMES.DATA_BACKFILL,
    async (job: Job<BackfillJobData>) => {
      const data = job.data;
      const jobConfig = await manager.createBackfillJob(
        data.exchange,
        data.symbol,
        data.timeframe,
        new Date(data.startTime),
        new Date(data.endTime),
      );
      return manager.runBackfill(jobConfig);
    },
    {
      connection: config.redisConnection,
      concurrency: 2,
    },
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
        outputDir: data.outputDir,
      });
    },
    {
      connection: config.redisConnection,
      concurrency: 1,
    },
  );
}
