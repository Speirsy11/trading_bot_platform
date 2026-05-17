import { randomUUID } from "node:crypto";

import { and, count, eq, gte, lte, sql } from "drizzle-orm";

import type { Database } from "../client";
import { ingestionEvents, type IngestionEventInsert } from "../schema/ingestionEvents";
import { ingestionHealth } from "../schema/ingestionHealth";
import { marketTickers, type MarketTickerInsert } from "../schema/marketTickers";
import { marketTrades, type MarketTradeInsert } from "../schema/marketTrades";
import { ohlcv, type OHLCVInsert } from "../schema/ohlcv";
import { orderBookSnapshots, type OrderBookSnapshotInsert } from "../schema/orderBookSnapshots";

export async function upsertMarketTrades(db: Database, rows: Omit<MarketTradeInsert, "id">[]) {
  if (rows.length === 0) return [];
  return db
    .insert(marketTrades)
    .values(rows.map((row) => ({ ...row, id: tradeEventId(row) })))
    .onConflictDoNothing()
    .returning();
}

export async function insertMarketTickers(db: Database, rows: Omit<MarketTickerInsert, "id">[]) {
  if (rows.length === 0) return [];
  return db
    .insert(marketTickers)
    .values(rows.map((row) => ({ ...row, id: randomUUID() })))
    .returning();
}

export async function insertOrderBookSnapshots(
  db: Database,
  rows: Omit<OrderBookSnapshotInsert, "id">[]
) {
  if (rows.length === 0) return [];
  return db
    .insert(orderBookSnapshots)
    .values(rows.map((row) => ({ ...row, id: randomUUID() })))
    .returning();
}

export async function logIngestionEvent(db: Database, event: IngestionEventInsert) {
  return db.insert(ingestionEvents).values(event).returning();
}

export async function updateIngestionHealth(
  db: Database,
  params: {
    exchange: string;
    symbol: string;
    timeframe: string;
    websocketStatus?: string;
    latestEventAt?: Date | null;
    latestCandleAt?: Date | null;
    candlesInsertedDelta?: number;
    validationFailuresDelta?: number;
    apiErrorsDelta?: number;
    restFallbackDelta?: number;
    repairFailuresDelta?: number;
    missingCandles?: number;
    backfillBacklog?: number;
    completenessBps?: number;
  }
) {
  const id = `${params.exchange}:${params.symbol}:${params.timeframe}`;
  await db
    .insert(ingestionHealth)
    .values({
      id,
      exchange: params.exchange,
      symbol: params.symbol,
      timeframe: params.timeframe,
      websocketStatus: params.websocketStatus ?? "unknown",
      latestEventAt: params.latestEventAt ?? null,
      latestCandleAt: params.latestCandleAt ?? null,
      candlesInserted: params.candlesInsertedDelta ?? 0,
      validationFailures: params.validationFailuresDelta ?? 0,
      apiErrors: params.apiErrorsDelta ?? 0,
      restFallbackCount: params.restFallbackDelta ?? 0,
      repairFailures: params.repairFailuresDelta ?? 0,
      missingCandles: params.missingCandles ?? 0,
      backfillBacklog: params.backfillBacklog ?? 0,
      completenessBps: params.completenessBps ?? 10000,
      disconnectedSince: params.websocketStatus === "disconnected" ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [ingestionHealth.exchange, ingestionHealth.symbol, ingestionHealth.timeframe],
      set: {
        websocketStatus: params.websocketStatus ?? sql`${ingestionHealth.websocketStatus}`,
        latestEventAt: params.latestEventAt ?? sql`${ingestionHealth.latestEventAt}`,
        latestCandleAt: params.latestCandleAt ?? sql`${ingestionHealth.latestCandleAt}`,
        candlesInserted: sql`${ingestionHealth.candlesInserted} + ${params.candlesInsertedDelta ?? 0}`,
        validationFailures: sql`${ingestionHealth.validationFailures} + ${params.validationFailuresDelta ?? 0}`,
        apiErrors: sql`${ingestionHealth.apiErrors} + ${params.apiErrorsDelta ?? 0}`,
        restFallbackCount: sql`${ingestionHealth.restFallbackCount} + ${params.restFallbackDelta ?? 0}`,
        repairFailures: sql`${ingestionHealth.repairFailures} + ${params.repairFailuresDelta ?? 0}`,
        missingCandles: params.missingCandles ?? sql`${ingestionHealth.missingCandles}`,
        backfillBacklog: params.backfillBacklog ?? sql`${ingestionHealth.backfillBacklog}`,
        completenessBps: params.completenessBps ?? sql`${ingestionHealth.completenessBps}`,
        disconnectedSince:
          params.websocketStatus === "disconnected"
            ? sql`COALESCE(${ingestionHealth.disconnectedSince}, NOW())`
            : params.websocketStatus === "connected"
              ? null
              : sql`${ingestionHealth.disconnectedSince}`,
        updatedAt: sql`NOW()`,
      },
    });
}

export async function buildCandlesFromTrades(
  db: Database,
  params: { exchange: string; symbol: string; timeframe: string; startTime: Date; endTime: Date }
): Promise<OHLCVInsert[]> {
  const bucketMs = timeframeToMs(params.timeframe);
  const rows = await db
    .select()
    .from(marketTrades)
    .where(
      and(
        eq(marketTrades.exchange, params.exchange),
        eq(marketTrades.symbol, params.symbol),
        gte(marketTrades.tradedAt, params.startTime),
        lte(marketTrades.tradedAt, params.endTime)
      )
    )
    .orderBy(marketTrades.tradedAt);

  const buckets = new Map<string, OHLCVInsert>();

  for (const trade of rows) {
    const bucketTime = Math.floor(trade.tradedAt.getTime() / bucketMs) * bucketMs;
    const key = String(bucketTime);
    const price = Number(trade.price);
    const amount = Number(trade.amount);
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        exchange: params.exchange,
        symbol: params.symbol,
        timeframe: params.timeframe,
        time: new Date(bucketTime),
        open: price.toString(),
        high: price.toString(),
        low: price.toString(),
        close: price.toString(),
        volume: amount.toString(),
        tradesCount: 1,
      });
      continue;
    }

    existing.high = Math.max(Number(existing.high), price).toString();
    existing.low = Math.min(Number(existing.low), price).toString();
    existing.close = price.toString();
    existing.volume = (Number(existing.volume) + amount).toString();
    existing.tradesCount = (existing.tradesCount ?? 0) + 1;
  }

  return [...buckets.values()].sort((a, b) => a.time.getTime() - b.time.getTime());
}

export async function deriveCandlesFromLowerTimeframe(
  db: Database,
  params: {
    exchange: string;
    symbol: string;
    sourceTimeframe: string;
    targetTimeframe: string;
    startTime: Date;
    endTime: Date;
  }
): Promise<OHLCVInsert[]> {
  const targetMs = timeframeToMs(params.targetTimeframe);
  const rows = await db
    .select()
    .from(ohlcv)
    .where(
      and(
        eq(ohlcv.exchange, params.exchange),
        eq(ohlcv.symbol, params.symbol),
        eq(ohlcv.timeframe, params.sourceTimeframe),
        gte(ohlcv.time, params.startTime),
        lte(ohlcv.time, params.endTime)
      )
    )
    .orderBy(ohlcv.time);

  const buckets = new Map<string, OHLCVInsert>();
  for (const row of rows) {
    const bucketTime = Math.floor(row.time.getTime() / targetMs) * targetMs;
    const key = String(bucketTime);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        exchange: params.exchange,
        symbol: params.symbol,
        timeframe: params.targetTimeframe,
        time: new Date(bucketTime),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        tradesCount: row.tradesCount ?? 0,
      });
      continue;
    }

    existing.high = Math.max(Number(existing.high), Number(row.high)).toString();
    existing.low = Math.min(Number(existing.low), Number(row.low)).toString();
    existing.close = row.close;
    existing.volume = (Number(existing.volume) + Number(row.volume)).toString();
    existing.tradesCount = (existing.tradesCount ?? 0) + (row.tradesCount ?? 0);
  }

  return [...buckets.values()].sort((a, b) => a.time.getTime() - b.time.getTime());
}

export async function countExpectedCandles(
  db: Database,
  params: { exchange: string; symbol: string; timeframe: string; startTime: Date; endTime: Date }
) {
  const existing = await db
    .select({ total: count() })
    .from(ohlcv)
    .where(
      and(
        eq(ohlcv.exchange, params.exchange),
        eq(ohlcv.symbol, params.symbol),
        eq(ohlcv.timeframe, params.timeframe),
        gte(ohlcv.time, params.startTime),
        lte(ohlcv.time, params.endTime)
      )
    );
  const expected = Math.max(
    0,
    Math.floor(
      (params.endTime.getTime() - params.startTime.getTime()) / timeframeToMs(params.timeframe)
    )
  );
  return { expected, actual: existing[0]?.total ?? 0 };
}

export function timeframeToMs(timeframe: string): number {
  const map: Record<string, number> = {
    "1m": 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
  };
  return map[timeframe] ?? 60_000;
}

function tradeEventId(row: Omit<MarketTradeInsert, "id">) {
  if (row.tradeId) return `${row.exchange}:${row.symbol}:${row.tradeId}`;
  return `${row.exchange}:${row.symbol}:${row.tradedAt.getTime()}:${row.price}:${row.amount}`;
}
