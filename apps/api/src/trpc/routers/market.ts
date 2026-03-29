import { queryOHLCVByRange, dataCollectionStatus, ohlcv } from "@tb/db";
import { timeframeToMs } from "@tb/trading-core";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getStrategyCatalog } from "../../services/strategyCatalog.js";
import { mapExchangeError } from "../../utils/errors.js";
import { toNumber } from "../../utils/serialization.js";
import { createTrpcRouter, publicProcedure } from "../trpc.js";

export const marketRouter = createTrpcRouter({
  getTicker: publicProcedure
    .input(z.object({ exchange: z.string(), symbol: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.exchangeManager.fetchTicker(input.exchange, input.symbol);
      } catch {
        const latest = await ctx.db
          .select()
          .from(ohlcv)
          .where(and(eq(ohlcv.exchange, input.exchange), eq(ohlcv.symbol, input.symbol)))
          .orderBy(desc(ohlcv.time))
          .limit(1);

        const candle = latest[0];
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
      if (input.startTime || input.endTime) {
        const rows = await queryOHLCVByRange(
          ctx.db,
          input.exchange,
          input.symbol,
          input.timeframe,
          new Date(input.startTime ?? 0),
          new Date(input.endTime ?? Date.now())
        );
        return rows.slice(-input.limit).map(serializeCandleRow);
      }

      const rows = await ctx.db
        .select()
        .from(ohlcv)
        .where(
          and(
            eq(ohlcv.exchange, input.exchange),
            eq(ohlcv.symbol, input.symbol),
            eq(ohlcv.timeframe, input.timeframe)
          )
        )
        .orderBy(desc(ohlcv.time))
        .limit(input.limit);

      return rows.reverse().map(serializeCandleRow);
    }),

  getSymbols: publicProcedure
    .input(z.object({ exchange: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.exchangeManager.getAvailableSymbols(input.exchange);
      } catch {
        const rows = await ctx.db
          .select({ symbol: ohlcv.symbol })
          .from(ohlcv)
          .where(eq(ohlcv.exchange, input.exchange))
          .groupBy(ohlcv.symbol)
          .orderBy(asc(ohlcv.symbol));

        return rows.map((row) => row.symbol);
      }
    }),

  getDataCoverage: publicProcedure
    .input(z.object({ exchange: z.string(), symbol: z.string(), timeframe: z.string() }))
    .query(async ({ ctx, input }) => {
      const status = await ctx.db
        .select()
        .from(dataCollectionStatus)
        .where(
          and(
            eq(dataCollectionStatus.exchange, input.exchange),
            eq(dataCollectionStatus.symbol, input.symbol),
            eq(dataCollectionStatus.timeframe, input.timeframe)
          )
        )
        .limit(1);

      const row = status[0];
      if (!row || !row.earliest || !row.latest) {
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

function serializeCandleRow(row: typeof ohlcv.$inferSelect) {
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
