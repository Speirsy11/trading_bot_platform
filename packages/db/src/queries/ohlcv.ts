import { and, eq, gte, lte, sql, count } from "drizzle-orm";

import type { Database } from "../client";
import { ohlcv, type OHLCVInsert } from "../schema/ohlcv";

export async function insertOHLCV(db: Database, rows: OHLCVInsert[]) {
  if (rows.length === 0) return [];
  return db.insert(ohlcv).values(rows).returning();
}

export async function upsertOHLCV(db: Database, rows: OHLCVInsert[]) {
  if (rows.length === 0) return [];
  return db
    .insert(ohlcv)
    .values(rows)
    .onConflictDoUpdate({
      target: [ohlcv.exchange, ohlcv.symbol, ohlcv.timeframe, ohlcv.time],
      set: {
        open: sql`excluded.open`,
        high: sql`excluded.high`,
        low: sql`excluded.low`,
        close: sql`excluded.close`,
        volume: sql`excluded.volume`,
        tradesCount: sql`excluded.trades_count`,
      },
    })
    .returning();
}

export async function queryOHLCVByRange(
  db: Database,
  exchange: string,
  symbol: string,
  timeframe: string,
  startTime: Date,
  endTime: Date
) {
  return db
    .select()
    .from(ohlcv)
    .where(
      and(
        eq(ohlcv.exchange, exchange),
        eq(ohlcv.symbol, symbol),
        eq(ohlcv.timeframe, timeframe),
        gte(ohlcv.time, startTime),
        lte(ohlcv.time, endTime)
      )
    )
    .orderBy(ohlcv.time);
}

export async function getLatestTimestamp(
  db: Database,
  exchange: string,
  symbol: string,
  timeframe: string
): Promise<Date | null> {
  const result = await db
    .select({ latest: sql<string>`MAX(${ohlcv.time})` })
    .from(ohlcv)
    .where(
      and(eq(ohlcv.exchange, exchange), eq(ohlcv.symbol, symbol), eq(ohlcv.timeframe, timeframe))
    );
  const raw = result[0]?.latest;
  return raw ? new Date(raw) : null;
}

export async function countCandles(
  db: Database,
  exchange: string,
  symbol: string,
  timeframe: string,
  startTime?: Date,
  endTime?: Date
): Promise<number> {
  const conditions = [
    eq(ohlcv.exchange, exchange),
    eq(ohlcv.symbol, symbol),
    eq(ohlcv.timeframe, timeframe),
  ];

  if (startTime) conditions.push(gte(ohlcv.time, startTime));
  if (endTime) conditions.push(lte(ohlcv.time, endTime));

  const result = await db
    .select({ total: count() })
    .from(ohlcv)
    .where(and(...conditions));

  return result[0]?.total ?? 0;
}
