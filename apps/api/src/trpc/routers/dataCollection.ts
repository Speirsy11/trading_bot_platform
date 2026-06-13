import { ingestionEvents, settings } from "@tb/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

import type { MarketQualityMetric } from "../../services/harvesterMarketData";
import { createTrpcRouter, protectedProcedure, publicProcedure } from "../trpc";

export const dataCollectionRouter = createTrpcRouter({
  /** Get collection status for all pairs or a specific exchange/pair */
  status: publicProcedure
    .input(
      z
        .object({
          exchange: z.string().optional(),
          symbol: z.string().optional(),
          timeframe: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.marketData.getQualityMetrics({
        exchange: input?.exchange,
        symbol: input?.symbol,
      });

      return rows
        .filter((row) => !input?.timeframe || row.timeframe === input.timeframe)
        .sort(sortCollectionStatusRows)
        .map(serializeCollectionStatusRow);
    }),

  /** Get current collection settings from the database */
  getConfig: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(settings)
      .where(
        sql`${settings.key} IN ('collection.pairs', 'collection.timeframes', 'collection.exchanges')`
      );

    const config: Record<string, string[]> = {};
    for (const row of rows) {
      config[row.key] = JSON.parse(row.value) as string[];
    }

    return {
      pairs: config["collection.pairs"] ?? [],
      timeframes: config["collection.timeframes"] ?? [],
      exchanges: config["collection.exchanges"] ?? [],
    };
  }),

  /** Trigger a historical backfill job */
  backfill: protectedProcedure
    .input(
      z.object({
        exchange: z.string().min(1),
        symbol: z.string().min(1),
        timeframe: z.string().min(1),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
      })
    )
    .mutation(async () => {
      return {
        queued: false,
        disabled: true,
        message:
          "Historical market-data backfill is owned by Signal Harvester. Trading bot platform is read-only for market data.",
      };
    }),

  /** Trigger gap detection for a specific pair */
  detectGaps: protectedProcedure
    .input(
      z.object({
        exchange: z.string().min(1),
        symbol: z.string().min(1),
        timeframe: z.string().min(1),
      })
    )
    .mutation(async () => {
      return {
        queued: false,
        disabled: true,
        message:
          "Gap detection/repair is owned by Signal Harvester. Trading bot platform is read-only for market data.",
      };
    }),

  /** Get data quality metrics per exchange/symbol/timeframe */
  getQualityMetrics: publicProcedure
    .input(
      z.object({
        exchange: z.string().optional(),
        symbol: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.marketData.getQualityMetrics(input);
    }),

  /** Get recent ingestion events for monitoring and alerting */
  events: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(25) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(ingestionEvents)
        .orderBy(sql`${ingestionEvents.createdAt} DESC`)
        .limit(input?.limit ?? 25);

      return rows.map((row) => ({
        ...row,
        createdAt: row.createdAt?.toISOString() ?? null,
      }));
    }),

  /** Get queue job counts for monitoring */
  queueStats: publicProcedure.query(async ({ ctx }) => {
    const exportQ = await ctx.queues.dataExportQueue.getJobCounts();

    return { export: exportQ };
  }),
});

function serializeCollectionStatusRow(row: MarketQualityMetric) {
  return {
    exchange: row.exchange,
    symbol: row.symbol,
    timeframe: row.timeframe,
    status: row.status,
    earliest: row.earliest,
    latest: row.latest,
    totalCandles: row.totalCandles,
    gapCount: row.gapCount,
    lastCollectedAt: row.lastUpdated,
  };
}

function sortCollectionStatusRows(a: MarketQualityMetric, b: MarketQualityMetric) {
  return (
    a.exchange.localeCompare(b.exchange) ||
    a.symbol.localeCompare(b.symbol) ||
    a.timeframe.localeCompare(b.timeframe)
  );
}
