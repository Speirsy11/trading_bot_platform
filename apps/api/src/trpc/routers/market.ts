import { orderBookSnapshots, DEFAULT_PAIRS } from "@tb/db";
import { timeframeToMs } from "@tb/trading-core";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { MarketCoverage } from "../../services/harvesterMarketData";
import { getStrategyCatalog } from "../../services/strategyCatalog";
import { mapExchangeError } from "../../utils/errors";
import { toNumber } from "../../utils/serialization";
import { createTrpcRouter, publicProcedure } from "../trpc";

export const marketRouter = createTrpcRouter({
  getTicker: publicProcedure
    .input(z.object({ exchange: z.string(), symbol: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        if (process.env["APP_MODE"] !== "testing") {
          return await ctx.exchangeManager.fetchTicker(input.exchange, input.symbol);
        }
        throw new Error("Testing mode uses local ticker fallback");
      } catch {
        const candle = await ctx.marketData.getLatestCandle(input.exchange, input.symbol);
        if (!candle) {
          throw mapExchangeError(
            new Error(`No market data available for ${input.exchange} ${input.symbol}`)
          );
        }

        return {
          exchange: input.exchange,
          symbol: input.symbol,
          bid: toNumber(candle.close),
          ask: toNumber(candle.close),
          last: toNumber(candle.close),
          volume: toNumber(candle.volume),
          change24h: 0,
          timestamp: candle.time.getTime(),
        };
      }
    }),

  getCandles: publicProcedure
    .input(
      z.object({
        exchange: z.string(),
        symbol: z.string(),
        timeframe: z.string(),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        limit: z.number().min(1).max(5000).default(500),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.marketData.getCandles({
        exchange: input.exchange,
        symbol: input.symbol,
        timeframe: input.timeframe,
        startTime: input.startTime ? new Date(input.startTime) : undefined,
        endTime: input.endTime ? new Date(input.endTime) : undefined,
        limit: input.limit,
      });
      return rows.map(serializeCandleRow);
    }),

  getChartSnapshot: publicProcedure
    .input(
      z.object({
        exchange: z.string(),
        symbol: z.string(),
        timeframe: z.string(),
        compareSymbol: z.string().optional(),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        limit: z.number().min(50).max(1500).default(700),
      })
    )
    .query(async ({ ctx, input }) => {
      const candleRequest = {
        exchange: input.exchange,
        timeframe: input.timeframe,
        startTime: input.startTime ? new Date(input.startTime) : undefined,
        endTime: input.endTime ? new Date(input.endTime) : undefined,
        limit: input.limit,
      };

      const [rows, coverage, compareRows, compareCoverage] = await Promise.all([
        ctx.marketData.getCandles({ ...candleRequest, symbol: input.symbol }),
        ctx.marketData.getCoverage(input.exchange, input.symbol, input.timeframe),
        input.compareSymbol
          ? ctx.marketData.getCandles({ ...candleRequest, symbol: input.compareSymbol })
          : Promise.resolve([]),
        input.compareSymbol
          ? ctx.marketData.getCoverage(input.exchange, input.compareSymbol, input.timeframe)
          : Promise.resolve(null),
      ]);

      const candles = rows.map(serializeCandleRow);
      const compareCandles = compareRows.map(serializeCandleRow);
      const nowMs = Date.now();

      return {
        exchange: input.exchange,
        symbol: input.symbol,
        timeframe: input.timeframe,
        candles,
        coverage: serializeCoverage(coverage, input.timeframe, nowMs),
        summary: summarizeChartCandles(candles, nowMs),
        relativePerformance: buildRelativePerformance(candles),
        compare: input.compareSymbol
          ? {
              symbol: input.compareSymbol,
              candles: compareCandles,
              coverage: serializeCoverage(compareCoverage!, input.timeframe, nowMs),
              summary: summarizeChartCandles(compareCandles, nowMs),
              relativePerformance: buildRelativePerformance(compareCandles),
            }
          : null,
      };
    }),

  getOrderBook: publicProcedure
    .input(
      z.object({
        exchange: z.string(),
        symbol: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (process.env["APP_MODE"] !== "testing") {
          return await ctx.exchangeManager.fetchOrderBook(
            input.exchange,
            input.symbol,
            input.limit
          );
        }
        throw new Error("Testing mode uses local order book fallback");
      } catch (error) {
        const latestSnapshot = await ctx.db
          .select()
          .from(orderBookSnapshots)
          .where(
            and(
              eq(orderBookSnapshots.exchange, input.exchange),
              eq(orderBookSnapshots.symbol, input.symbol)
            )
          )
          .orderBy(desc(orderBookSnapshots.snapshotAt))
          .limit(1);

        const snapshot = latestSnapshot[0];
        if (snapshot) {
          return {
            exchange: input.exchange,
            symbol: input.symbol,
            bids: (snapshot.bids as [number, number][]).slice(0, input.limit),
            asks: (snapshot.asks as [number, number][]).slice(0, input.limit),
            timestamp: snapshot.snapshotAt.getTime(),
          };
        }

        const candle = await ctx.marketData.getLatestCandle(input.exchange, input.symbol);
        if (!candle) throw mapExchangeError(error);

        const mid = toNumber(candle.close);
        return {
          exchange: input.exchange,
          symbol: input.symbol,
          bids: Array.from({ length: input.limit }, (_, index) => [
            Number((mid * (1 - (index + 1) * 0.0005)).toFixed(8)),
            Number((1 + index * 0.15).toFixed(8)),
          ]) as [number, number][],
          asks: Array.from({ length: input.limit }, (_, index) => [
            Number((mid * (1 + (index + 1) * 0.0005)).toFixed(8)),
            Number((1 + index * 0.15).toFixed(8)),
          ]) as [number, number][],
          timestamp: candle.time.getTime(),
        };
      }
    }),

  getSymbols: publicProcedure
    .input(z.object({ exchange: z.string(), collectedOnly: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        if (process.env["APP_MODE"] !== "testing") {
          const symbols = await ctx.exchangeManager.getAvailableSymbols(input.exchange);
          return input.collectedOnly ? symbols.filter((s) => DEFAULT_PAIRS.includes(s)) : symbols;
        }
        throw new Error("Testing mode uses local symbols fallback");
      } catch {
        const symbols = await ctx.marketData.getSymbols(input.exchange);
        return input.collectedOnly ? symbols.filter((s) => DEFAULT_PAIRS.includes(s)) : symbols;
      }
    }),

  getDataCoverage: publicProcedure
    .input(z.object({ exchange: z.string(), symbol: z.string(), timeframe: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.marketData.getCoverage(input.exchange, input.symbol, input.timeframe);
      if (!row.earliest || !row.latest) {
        return {
          earliest: null,
          latest: null,
          gapCount: 0,
          completeness: 0,
          totalCandles: 0,
        };
      }

      const intervalMs = timeframeToMs(input.timeframe);
      const expected = Math.max(
        Math.floor((row.latest.getTime() - row.earliest.getTime()) / intervalMs) + 1,
        0
      );
      const totalCandles = row.totalCandles ?? 0;

      return {
        earliest: row.earliest.toISOString(),
        latest: row.latest.toISOString(),
        gapCount: row.gapCount ?? 0,
        completeness: expected > 0 ? (totalCandles / expected) * 100 : 0,
        totalCandles,
      };
    }),

  getStrategies: publicProcedure.query(async () => getStrategyCatalog()),
});

type CandleLike = {
  time: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradesCount?: number | null;
};

export type SerializedCandleRow = ReturnType<typeof serializeCandleRow>;

function serializeCandleRow(row: CandleLike) {
  return {
    time: row.time.getTime(),
    open: toNumber(row.open),
    high: toNumber(row.high),
    low: toNumber(row.low),
    close: toNumber(row.close),
    volume: toNumber(row.volume),
    tradesCount: row.tradesCount ?? 0,
  };
}

export function serializeCoverage(row: MarketCoverage, timeframe: string, nowMs: number) {
  if (!row.earliest || !row.latest) {
    return {
      earliest: null,
      latest: null,
      gapCount: 0,
      completeness: 0,
      totalCandles: 0,
      latestCandleAgeMs: null,
    };
  }

  const intervalMs = timeframeToMs(timeframe);
  const expected = Math.max(
    Math.floor((row.latest.getTime() - row.earliest.getTime()) / intervalMs) + 1,
    0
  );
  const totalCandles = row.totalCandles ?? 0;

  return {
    earliest: row.earliest.toISOString(),
    latest: row.latest.toISOString(),
    gapCount: row.gapCount ?? 0,
    completeness: expected > 0 ? (totalCandles / expected) * 100 : 0,
    totalCandles,
    latestCandleAgeMs: Math.max(nowMs - row.latest.getTime(), 0),
  };
}

export function summarizeChartCandles(candles: SerializedCandleRow[], nowMs = Date.now()) {
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) {
    return {
      candleCount: 0,
      firstTime: null,
      lastTime: null,
      latestPrice: null,
      returnPct: null,
      high: null,
      low: null,
      rangePct: null,
      totalVolume: 0,
      averageVolume: 0,
      latestVolume: null,
      latestCandleAgeMs: null,
      volatilityPct: null,
    };
  }

  const high = candles.reduce(
    (max, candle) => Math.max(max, candle.high),
    Number.NEGATIVE_INFINITY
  );
  const low = candles.reduce((min, candle) => Math.min(min, candle.low), Number.POSITIVE_INFINITY);
  const totalVolume = candles.reduce((sum, candle) => sum + candle.volume, 0);
  const logReturns = candles.slice(1).map((candle, index) => {
    const previous = candles[index]?.close ?? candle.open;
    return previous > 0 ? Math.log(candle.close / previous) : 0;
  });
  const meanLogReturn =
    logReturns.length > 0
      ? logReturns.reduce((sum, value) => sum + value, 0) / logReturns.length
      : 0;
  const variance =
    logReturns.length > 1
      ? logReturns.reduce((sum, value) => sum + (value - meanLogReturn) ** 2, 0) /
        (logReturns.length - 1)
      : 0;

  return {
    candleCount: candles.length,
    firstTime: first.time,
    lastTime: last.time,
    latestPrice: last.close,
    returnPct: first.open > 0 ? ((last.close - first.open) / first.open) * 100 : null,
    high,
    low,
    rangePct: first.open > 0 ? ((high - low) / first.open) * 100 : null,
    totalVolume,
    averageVolume: totalVolume / candles.length,
    latestVolume: last.volume,
    latestCandleAgeMs: Math.max(nowMs - last.time, 0),
    volatilityPct: Math.sqrt(variance) * 100,
  };
}

export function buildRelativePerformance(candles: SerializedCandleRow[]) {
  const first = candles.find((candle) => candle.close > 0);
  if (!first) return [];

  return candles.map((candle) => ({
    time: candle.time,
    value: ((candle.close - first.close) / first.close) * 100,
  }));
}
