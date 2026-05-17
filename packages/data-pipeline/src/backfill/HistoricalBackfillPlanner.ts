import { getEarliestTimestamp, logIngestionEvent, type Database } from "@tb/db";
import type { Queue } from "bullmq";

import { JOB_NAMES, DEFAULT_JOB_OPTIONS, type BackfillJobData } from "../jobs/types";

const DAY_MS = 24 * 60 * 60_000;

const BINANCE_SPOT_START_DATES: Record<string, string> = {
  "BTC/USDT": "2017-08-17T00:00:00.000Z",
  "ETH/USDT": "2017-08-17T00:00:00.000Z",
  "SOL/USDT": "2020-08-11T00:00:00.000Z",
};

const DEFAULT_EXCHANGE_START_DATES: Record<string, string> = {
  binance: "2017-08-17T00:00:00.000Z",
};

const HISTORICAL_TIMEFRAME = "1m";
const HISTORICAL_CHUNK_DAYS = 7;

export interface HistoricalBackfillPlanInput {
  exchanges: string[];
  symbols: string[];
  /**
   * Live collection can still run multiple timeframes, but deep history is
   * intentionally fetched only as 1m candles. Higher intervals should be
   * derived from the 1m base dataset so all price history has one canonical
   * source of truth.
   */
  timeframes?: string[];
  maxChunksPerRun?: number;
  now?: Date;
}

export interface HistoricalBackfillPlanResult {
  queued: number;
  exhausted: number;
}

function symbolStartDate(exchange: string, symbol: string): Date {
  const key = exchange === "binance" ? BINANCE_SPOT_START_DATES[symbol] : undefined;
  return new Date(key ?? DEFAULT_EXCHANGE_START_DATES[exchange] ?? "2017-01-01T00:00:00.000Z");
}

function symbolSlug(symbol: string): string {
  return symbol.replace("/", "-");
}

/**
 * Slowly walks each configured market backwards from the oldest 1m candle we already have.
 *
 * This deliberately schedules a tiny amount of low-priority work per run so the system
 * keeps current collection and recent gap repair ahead of deep historical crawling.
 */
export async function planHistoricalBackfill(
  db: Database,
  queue: Queue<BackfillJobData>,
  input: HistoricalBackfillPlanInput
): Promise<HistoricalBackfillPlanResult> {
  const maxChunks = input.maxChunksPerRun ?? 3;
  const now = input.now ?? new Date();
  let queued = 0;
  let exhausted = 0;

  for (const exchange of input.exchanges) {
    for (const symbol of input.symbols) {
      const firstAvailable = symbolStartDate(exchange, symbol);

      if (queued >= maxChunks) return { queued, exhausted };

      const timeframe = HISTORICAL_TIMEFRAME;
      const earliestSaved = await getEarliestTimestamp(db, exchange, symbol, timeframe);
      const crawlEnd = earliestSaved ?? now;

      if (crawlEnd <= firstAvailable) {
        exhausted++;
        continue;
      }

      const chunkMs = HISTORICAL_CHUNK_DAYS * DAY_MS;
      const crawlStart = new Date(Math.max(firstAvailable.getTime(), crawlEnd.getTime() - chunkMs));

      const data: BackfillJobData = {
        exchange,
        symbol,
        timeframe,
        startTime: crawlStart.toISOString(),
        endTime: crawlEnd.toISOString(),
        reason: "historical-crawl",
        priority: 4,
      };

      await queue.add(JOB_NAMES.BACKFILL, data, {
        ...DEFAULT_JOB_OPTIONS,
        priority: 4,
        jobId: `historical-crawl-${exchange}-${symbolSlug(symbol)}-${timeframe}-${data.startTime}`,
      });

      await logIngestionEvent(db, {
        exchange,
        symbol,
        timeframe,
        eventType: "historical_backfill_queued",
        severity: "info",
        message: `Queued historical ${timeframe} backfill chunk`,
        metadata: { startTime: data.startTime, endTime: data.endTime },
      });

      queued++;
    }
  }

  return { queued, exhausted };
}
