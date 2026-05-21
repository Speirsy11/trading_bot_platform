import { dataCollectionStatus, ingestionEvents, ingestionHealth, settings } from "@tb/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

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
      const conditions = [];
      if (input?.exchange) conditions.push(eq(dataCollectionStatus.exchange, input.exchange));
      if (input?.symbol) conditions.push(eq(dataCollectionStatus.symbol, input.symbol));
      if (input?.timeframe) conditions.push(eq(dataCollectionStatus.timeframe, input.timeframe));

      const rows = await ctx.db
        .select()
        .from(dataCollectionStatus)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          dataCollectionStatus.exchange,
          dataCollectionStatus.symbol,
          dataCollectionStatus.timeframe
        );

      return rows.map((r) => ({
        exchange: r.exchange,
        symbol: r.symbol,
        timeframe: r.timeframe,
        status: r.status,
        earliest: r.earliest?.toISOString() ?? null,
        latest: r.latest?.toISOString() ?? null,
        totalCandles: r.totalCandles,
        gapCount: r.gapCount,
        lastCollectedAt: r.lastCollectedAt?.toISOString() ?? null,
      }));
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
      const conditions = [];
      if (input.exchange) conditions.push(eq(dataCollectionStatus.exchange, input.exchange));
      if (input.symbol) conditions.push(eq(dataCollectionStatus.symbol, input.symbol));

      const rows = await ctx.db
        .select()
        .from(dataCollectionStatus)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          dataCollectionStatus.exchange,
          dataCollectionStatus.symbol,
          dataCollectionStatus.timeframe
        );

      const healthConditions = [];
      if (input.exchange) healthConditions.push(eq(ingestionHealth.exchange, input.exchange));
      if (input.symbol) healthConditions.push(eq(ingestionHealth.symbol, input.symbol));
      const healthRows = await ctx.db
        .select()
        .from(ingestionHealth)
        .where(healthConditions.length > 0 ? and(...healthConditions) : undefined);
      const healthByKey = new Map(
        healthRows.map((row) => [`${row.exchange}:${row.symbol}:${row.timeframe}`, row])
      );

      return rows.map((r) => {
        const health = healthByKey.get(`${r.exchange}:${r.symbol}:${r.timeframe}`);
        const latest = health?.latestCandleAt ?? r.latest;
        return {
          exchange: r.exchange,
          symbol: r.symbol,
          timeframe: r.timeframe,
          totalCandles: r.totalCandles ?? 0,
          gapCount: r.gapCount ?? 0,
          latestCandleAgeMs: latest ? Date.now() - latest.getTime() : null,
          websocketStatus: health?.websocketStatus ?? "unknown",
          restFallbackCount: health?.restFallbackCount ?? 0,
          validationFailures: health?.validationFailures ?? 0,
          apiErrors: health?.apiErrors ?? 0,
          repairFailures: health?.repairFailures ?? 0,
          backfillBacklog: health?.backfillBacklog ?? 0,
          candlesInserted: health?.candlesInserted ?? 0,
          missingCandles: health?.missingCandles ?? r.gapCount ?? 0,
          completenessPct: ((health?.completenessBps ?? 10000) / 100).toFixed(2),
          lastUpdated: r.lastCollectedAt?.toISOString() ?? null,
          status: r.status ?? "idle",
        };
      });
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
