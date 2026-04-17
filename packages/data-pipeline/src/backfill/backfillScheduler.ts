import type { Queue } from "bullmq";

import { JOB_NAMES, DEFAULT_JOB_OPTIONS, type BackfillJobData } from "../jobs/types";

const CHUNK_MS = 30 * 24 * 60 * 60_000; // 30 days in milliseconds

const DAY_MS = 24 * 60 * 60_000;

/**
 * Returns a BullMQ priority (1 = highest, 4 = lowest) based on how far back
 * the chunk's end date is from now.
 *
 *   0–30 days ago  → priority 1
 *  31–90 days ago  → priority 2
 *  91–365 days ago → priority 3
 *  >365 days ago   → priority 4
 */
export function backfillChunkPriority(chunkEnd: Date, now = new Date()): number {
  const daysAgo = (now.getTime() - chunkEnd.getTime()) / DAY_MS;

  if (daysAgo <= 30) return 1;
  if (daysAgo <= 90) return 2;
  if (daysAgo <= 365) return 3;
  return 4;
}

/**
 * Splits [fromDate, toDate] into 30-day chunks and enqueues each as a
 * separate BullMQ job on the provided backfill queue. Jobs covering more
 * recent data receive a higher priority (lower number) so they are processed
 * first.
 *
 * Chunk order: most-recent chunk first, so jobs are enqueued newest → oldest.
 */
export async function scheduleBackfill(
  queue: Queue<BackfillJobData>,
  exchange: string,
  symbol: string,
  timeframe: string,
  fromDate: Date,
  toDate: Date
): Promise<void> {
  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();

  if (fromMs >= toMs) {
    throw new Error(
      `scheduleBackfill: fromDate (${fromDate.toISOString()}) must be before toDate (${toDate.toISOString()})`
    );
  }

  // Build chunks newest-first so high-priority jobs are enqueued first.
  const chunks: Array<{ start: Date; end: Date }> = [];
  let chunkEnd = toMs;

  while (chunkEnd > fromMs) {
    const chunkStart = Math.max(fromMs, chunkEnd - CHUNK_MS);
    chunks.push({ start: new Date(chunkStart), end: new Date(chunkEnd) });
    chunkEnd = chunkStart;
  }

  const now = new Date();

  for (const chunk of chunks) {
    const priority = backfillChunkPriority(chunk.end, now);
    const symbolSlug = symbol.replace("/", "-");
    const jobId = `backfill-${exchange}-${symbolSlug}-${timeframe}-${chunk.start.toISOString()}`;

    const data: BackfillJobData = {
      exchange,
      symbol,
      timeframe,
      startTime: chunk.start.toISOString(),
      endTime: chunk.end.toISOString(),
    };

    await queue.add(JOB_NAMES.BACKFILL, data, {
      ...DEFAULT_JOB_OPTIONS,
      priority,
      jobId,
    });
  }
}
