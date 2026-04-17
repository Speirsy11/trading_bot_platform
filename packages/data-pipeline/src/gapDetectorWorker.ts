import { createLogger } from "@tb/config";
import type { Database } from "@tb/db";
import { Worker } from "bullmq";

import { detectAllGaps } from "./gapDetector";

const logger = createLogger("gap-detector-worker");

const QUEUE_NAME = "gap-detection";
const REPEAT_PATTERN = "*/15 * * * *";

export interface GapDetectorWorkerConfig {
  db: Database;
  redisConnection: { host: string; port: number };
}

export function createGapDetectorWorker(config: GapDetectorWorkerConfig) {
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      logger.info("Running gap detection across all exchange/symbol/timeframe combos");

      const gaps = await detectAllGaps(config.db);

      if (gaps.length === 0) {
        logger.info("Gap detection complete: no gaps found");
      } else {
        for (const gap of gaps) {
          logger.warn(
            {
              exchange: gap.exchange,
              symbol: gap.symbol,
              timeframe: gap.timeframe,
              gapStart: gap.gapStart.toISOString(),
              gapEnd: gap.gapEnd.toISOString(),
              expectedIntervalMs: gap.expectedIntervalMs,
              actualGapMs: gap.actualGapMs,
            },
            "OHLCV gap detected"
          );
        }
        logger.info({ totalGaps: gaps.length }, "Gap detection complete");
      }

      return { totalGaps: gaps.length };
    },
    {
      connection: config.redisConnection,
      concurrency: 1,
    }
  );

  return worker;
}

export { QUEUE_NAME as GAP_DETECTION_QUEUE, REPEAT_PATTERN as GAP_DETECTION_REPEAT_PATTERN };
