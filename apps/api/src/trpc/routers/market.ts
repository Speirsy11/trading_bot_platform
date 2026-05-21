import { orderBookSnapshots, DEFAULT_PAIRS } from "@tb/db";
import { timeframeToMs } from "@tb/trading-core";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

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
