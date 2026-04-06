import { backtestTrades, backtests, type Database } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { BACKTEST_JOB_NAMES } from "../../queues/types";
import { toNumber } from "../../utils/serialization";
import { backtestConfigSchema, uuidSchema } from "../schemas";
import { createTrpcRouter, publicProcedure } from "../trpc";

export const backtestRouter = createTrpcRouter({
  run: publicProcedure.input(backtestConfigSchema).mutation(async ({ ctx, input }) => {
    const inserted = await ctx.db
      .insert(backtests)
      .values({
        name: input.name,
        strategy: input.strategy,
        strategyParams: input.strategyParams,
        exchange: input.exchange,
        symbol: input.symbol,
        timeframe: input.timeframe,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        initialBalance: input.initialBalance.toString(),
        riskConfig: input.riskConfig,
        metrics: { fees: input.fees, slippage: input.slippage },
        status: "unqueued",
      })
      .returning();

    const backtest = inserted[0];
    if (!backtest) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create backtest row before queueing",
      });
    }

    const jobId = `backtest-${backtest.id}`;

    try {
      await ctx.queues.backtestQueue.add(
        BACKTEST_JOB_NAMES.RUN,
        { backtestId: backtest.id },
        { jobId, removeOnComplete: false, removeOnFail: false }
      );
      await ctx.redis.publish(
        "backtest:progress",
        JSON.stringify({ backtestId: backtest.id, progress: 0, currentDate: input.startTime })
      );
      await ctx.db
        .update(backtests)
        .set({ status: "pending" })
        .where(eq(backtests.id, backtest.id));
    } catch (error) {
      const job = await ctx.queues.backtestQueue.getJob(jobId);
      await job?.remove().catch(() => undefined);
      await ctx.db.delete(backtests).where(eq(backtests.id, backtest.id));
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Failed to enqueue backtest job",
        cause: error,
      });
    }

    return { backtestId: backtest.id };
  }),

  getStatus: publicProcedure
    .input(z.object({ backtestId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const row = await findBacktest(ctx.db, input.backtestId);
      const job = await ctx.queues.backtestQueue.getJob(`backtest-${input.backtestId}`);
      const jobProgress = job?.progress;
      const progress =
        typeof jobProgress === "number"
          ? jobProgress
          : jobProgress && typeof jobProgress === "object" && "progress" in jobProgress
            ? Number((jobProgress as { progress?: number }).progress ?? 0)
            : row.status === "completed"
              ? 100
              : row.status === "running"
                ? 50
                : 0;

      return {
        status: row.status,
        progress,
        currentDate:
          jobProgress && typeof jobProgress === "object" && "currentDate" in jobProgress
            ? Number((jobProgress as { currentDate?: number }).currentDate ?? 0) || null
            : (row.completedAt?.getTime() ?? null),
        error: row.error,
      };
    }),

  getResults: publicProcedure
    .input(z.object({ backtestId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const row = await findBacktest(ctx.db, input.backtestId);
      const trades = await ctx.db
        .select()
        .from(backtestTrades)
        .where(eq(backtestTrades.backtestId, input.backtestId))
        .orderBy(desc(backtestTrades.executedAt));

      return {
        ...serializeBacktest(row),
        trades: trades.map((trade) => ({
          ...trade,
          amount: toNumber(trade.amount),
          price: toNumber(trade.price),
          cost: toNumber(trade.cost),
          fee: toNumber(trade.fee),
          pnl: toNumber(trade.pnl),
          pnlPercent: toNumber(trade.pnlPercent),
          balance: toNumber(trade.balance),
          executedAt: trade.executedAt.toISOString(),
        })),
      };
    }),

  list: publicProcedure
    .input(
      z
        .object({
          strategy: z.string().optional(),
          symbol: z.string().optional(),
          limit: z.number().min(1).max(100).default(20),
        })
        .default({ limit: 20 })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.strategy) {
        conditions.push(eq(backtests.strategy, input.strategy));
      }
      if (input.symbol) {
        conditions.push(eq(backtests.symbol, input.symbol));
      }

      const rows = await ctx.db
        .select()
        .from(backtests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(backtests.createdAt))
        .limit(input.limit);

      return rows.map(serializeBacktest);
    }),

  delete: publicProcedure
    .input(z.object({ backtestId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await findBacktest(ctx.db, input.backtestId);
      const job = await ctx.queues.backtestQueue.getJob(`backtest-${input.backtestId}`);
      await job?.remove().catch((error) => {
        ctx.req?.log.warn({ error, backtestId: input.backtestId }, "failed to remove backtest job");
      });
      await ctx.db.delete(backtests).where(eq(backtests.id, input.backtestId));
      return { success: true };
    }),
});

async function findBacktest(db: Database, backtestId: string) {
  const rows = await db.select().from(backtests).where(eq(backtests.id, backtestId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Backtest not found" });
  }
  return row;
}

function serializeBacktest(row: typeof backtests.$inferSelect) {
  return {
    ...row,
    initialBalance: toNumber(row.initialBalance),
    finalBalance: toNumber(row.finalBalance),
    totalPnl: toNumber(row.totalPnl),
    totalPnlPercent: toNumber(row.totalPnlPercent),
    winRate: toNumber(row.winRate),
    maxDrawdown: toNumber(row.maxDrawdown),
    sharpeRatio: toNumber(row.sharpeRatio),
    profitFactor: toNumber(row.profitFactor),
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    createdAt: row.createdAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
