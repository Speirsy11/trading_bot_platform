import {
  queryOHLCVByRange,
  dataCollectionStatus,
  deriveCandlesFromLowerTimeframe,
  ohlcv,
  orderBookSnapshots,
  DEFAULT_PAIRS,
} from "@tb/db";
import { timeframeToMs } from "@tb/trading-core";
import { and, asc, desc, eq } from "drizzle-orm";
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
        const startTime = new Date(input.startTime ?? 0);
        const endTime = new Date(input.endTime ?? Date.now());
        const rows =
          input.timeframe === "1m"
            ? await queryOHLCVByRange(
                ctx.db,
                input.exchange,
                input.symbol,
                "1m",
                startTime,
                endTime
              )
            : await deriveCandlesFromLowerTimeframe(ctx.db, {
                exchange: input.exchange,
                symbol: input.symbol,
                sourceTimeframe: "1m",
                targetTimeframe: input.timeframe,
                startTime,
                endTime,
              });
        return rows.slice(-input.limit).map(serializeCandleRow);
      }

      if (input.timeframe !== "1m") {
        const latest = await ctx.db
          .select({ time: ohlcv.time })
          .from(ohlcv)
          .where(
            and(
              eq(ohlcv.exchange, input.exchange),
              eq(ohlcv.symbol, input.symbol),
              eq(ohlcv.timeframe, "1m")
            )
          )
          .orderBy(desc(ohlcv.time))
          .limit(1);
        const latestTime = latest[0]?.time;
        if (!latestTime) return [];

        const windowMs = timeframeToMs(input.timeframe) * (input.limit + 1);
        const rows = await deriveCandlesFromLowerTimeframe(ctx.db, {
          exchange: input.exchange,
          symbol: input.symbol,
          sourceTimeframe: "1m",
          targetTimeframe: input.timeframe,
          startTime: new Date(latestTime.getTime() - windowMs),
          endTime: latestTime,
        });
        return rows.slice(-input.limit).map(serializeCandleRow);
      }

      const rows = await ctx.db
        .select()
        .from(ohlcv)
        .where(
          and(
            eq(ohlcv.exchange, input.exchange),
            eq(ohlcv.symbol, input.symbol),
            eq(ohlcv.timeframe, "1m")
          )
        )
        .orderBy(desc(ohlcv.time))
        .limit(input.limit);

      return rows.reverse().map(serializeCandleRow);
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

        const latest = await ctx.db
          .select()
          .from(ohlcv)
          .where(
            and(
              eq(ohlcv.exchange, input.exchange),
              eq(ohlcv.symbol, input.symbol),
              eq(ohlcv.timeframe, "1m")
            )
          )
          .orderBy(desc(ohlcv.time))
          .limit(1);

        const candle = latest[0];
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
        const rows = await ctx.db
          .select({ symbol: ohlcv.symbol })
          .from(ohlcv)
          .where(eq(ohlcv.exchange, input.exchange))
          .groupBy(ohlcv.symbol)
          .orderBy(asc(ohlcv.symbol));

        const symbols = rows.map((row) => row.symbol);
        return input.collectedOnly ? symbols.filter((s) => DEFAULT_PAIRS.includes(s)) : symbols;
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
