import type { Database } from "@tb/db";
import { ohlcv } from "@tb/db";
import { and, asc, eq, sql } from "drizzle-orm";

export interface OhlcvGap {
  exchange: string;
  symbol: string;
  timeframe: string;
  gapStart: Date;
  gapEnd: Date;
  expectedIntervalMs: number;
  actualGapMs: number;
}

const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

function timeframeToMs(timeframe: string): number {
  return TIMEFRAME_MS[timeframe] ?? 60_000;
}

export async function detectGaps(
  db: Database,
  exchange: string,
  symbol: string,
  timeframe: string
): Promise<OhlcvGap[]> {
  const expectedIntervalMs = timeframeToMs(timeframe);

  const rows = await db
    .select({ time: ohlcv.time })
    .from(ohlcv)
    .where(
      and(eq(ohlcv.exchange, exchange), eq(ohlcv.symbol, symbol), eq(ohlcv.timeframe, timeframe))
    )
    .orderBy(asc(ohlcv.time));

  if (rows.length < 2) return [];

  const gaps: OhlcvGap[] = [];

  for (let i = 0; i < rows.length - 1; i++) {
    const curr = rows[i]!.time!;
    const next = rows[i + 1]!.time!;
    const actualGapMs = next.getTime() - curr.getTime();

    if (actualGapMs > 2 * expectedIntervalMs) {
      gaps.push({
        exchange,
        symbol,
        timeframe,
        gapStart: curr,
        gapEnd: next,
        expectedIntervalMs,
        actualGapMs,
      });
    }
  }

  return gaps;
}

export async function detectAllGaps(db: Database): Promise<OhlcvGap[]> {
  const combos = await db
    .selectDistinct({
      exchange: ohlcv.exchange,
      symbol: ohlcv.symbol,
      timeframe: ohlcv.timeframe,
    })
    .from(ohlcv)
    .orderBy(sql`${ohlcv.exchange}`, sql`${ohlcv.symbol}`, sql`${ohlcv.timeframe}`);

  const results = await Promise.all(
    combos.map((c) => detectGaps(db, c.exchange, c.symbol, c.timeframe))
  );

  return results.flat();
}
