import { dataCollectionStatus, settings } from "@tb/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { createTrpcRouter, publicProcedure } from "../trpc";

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
  backfill: publicProcedure
    .input(
      z.object({
        exchange: z.string().min(1),
        symbol: z.string().min(1),
        timeframe: z.string().min(1),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.queues.dataBackfillQueue.add(
        "backfill",
        {
          exchange: input.exchange,
          symbol: input.symbol,
          timeframe: input.timeframe,
          startTime: input.startTime,
          endTime: input.endTime,
        },
        {
          jobId: `backfill-${input.exchange}-${input.symbol.replace("/", "-")}-${input.timeframe}-${Date.now()}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
        }
      );

      return { queued: true };
    }),

  /** Trigger gap detection for a specific pair */
  detectGaps: publicProcedure
    .input(
      z.object({
        exchange: z.string().min(1),
        symbol: z.string().min(1),
        timeframe: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.queues.dataCollectionQueue.add(
        "detect-gaps",
        {
          exchange: input.exchange,
          symbol: input.symbol,
          timeframe: input.timeframe,
        },
        {
          jobId: `detect-gaps-manual-${input.exchange}-${input.symbol.replace("/", "-")}-${input.timeframe}-${Date.now()}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        }
      );

      return { queued: true };
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

      return rows.map((r) => ({
        exchange: r.exchange,
        symbol: r.symbol,
        timeframe: r.timeframe,
        totalCandles: r.totalCandles ?? 0,
        gapCount: r.gapCount ?? 0,
        lastUpdated: r.lastCollectedAt?.toISOString() ?? null,
        status: r.status ?? "idle",
      }));
    }),

  /** Get queue job counts for monitoring */
  queueStats: publicProcedure.query(async ({ ctx }) => {
    const [collection, backfill, exportQ] = await Promise.all([
      ctx.queues.dataCollectionQueue.getJobCounts(),
      ctx.queues.dataBackfillQueue.getJobCounts(),
      ctx.queues.dataExportQueue.getJobCounts(),
    ]);

    return { collection, backfill, export: exportQ };
  }),
});
