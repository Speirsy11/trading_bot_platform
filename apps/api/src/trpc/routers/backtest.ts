import { backtestTrades, backtests, researchResults, type Database } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { BACKTEST_JOB_NAMES } from "../../queues/types";
import { RESEARCH_EXECUTION_DEFAULTS } from "../../services/researchEngine";
import {
  assertResearchReplayConfigMatches,
  assertResearchReplayWindowMatches,
} from "../../services/researchProvenance";
import { jobEnqueuedCounter } from "../../utils/metrics";
import { parseJsonValue, toNumber } from "../../utils/serialization";
import { backtestConfigSchema, uuidSchema } from "../schemas";
import { createTrpcRouter, protectedProcedure, publicProcedure } from "../trpc";

export const backtestRouter = createTrpcRouter({
  run: protectedProcedure.input(backtestConfigSchema).mutation(async ({ ctx, input }) => {
    const sourceEvidence = input.sourceResearch
      ? await buildResearchSourceEvidence(ctx.db, input.sourceResearch, input)
      : null;
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
        metrics: {
          fees: input.fees,
          slippage: input.slippage,
          ...(sourceEvidence ? { sourceEvidence } : {}),
        },
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
      jobEnqueuedCounter.inc({ queue: "backtest" });
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
      const conditions = [isNull(backtests.deletedAt)];
      if (input.strategy) {
        conditions.push(eq(backtests.strategy, input.strategy));
      }
      if (input.symbol) {
        conditions.push(eq(backtests.symbol, input.symbol));
      }

      const rows = await ctx.db
        .select()
        .from(backtests)
        .where(and(...conditions))
        .orderBy(desc(backtests.createdAt))
        .limit(input.limit);

      return rows.map(serializeBacktest);
    }),

  compare: publicProcedure
    .input(z.object({ backtestIds: z.array(uuidSchema).min(2).max(10) }))
    .query(async ({ ctx, input }) => {
      const results = await Promise.all(
        input.backtestIds.map(async (backtestId) => {
          const row = await findBacktest(ctx.db, backtestId);
          return buildBacktestCompareRun(row);
        })
      );

      return results;
    }),

  failures: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const failed = await ctx.queues.backtestQueue.getFailed(0, input.limit - 1);
      return failed.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
      }));
    }),

  delete: protectedProcedure
    .input(z.object({ backtestId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await findBacktest(ctx.db, input.backtestId);
      const job = await ctx.queues.backtestQueue.getJob(`backtest-${input.backtestId}`);
      await job?.remove().catch((error) => {
        ctx.req?.log.warn({ error, backtestId: input.backtestId }, "failed to remove backtest job");
      });
      await ctx.db
        .update(backtests)
        .set({ deletedAt: new Date() })
        .where(eq(backtests.id, input.backtestId));
      return { success: true };
    }),
});

async function findBacktest(db: Database, backtestId: string) {
  const rows = await db
    .select()
    .from(backtests)
    .where(and(eq(backtests.id, backtestId), isNull(backtests.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Backtest not found" });
  }
  return row;
}

async function buildResearchSourceEvidence(
  db: Database,
  researchResultId: string,
  config: {
    strategy: string;
    strategyParams: Record<string, unknown>;
    symbol: string;
    timeframe: string;
    startTime: number;
    endTime: number;
    initialBalance: number;
    fees: { maker: number; taker: number };
    slippage: { enabled: boolean; percentage: number };
  }
) {
  const rows = await db
    .select()
    .from(researchResults)
    .where(eq(researchResults.id, researchResultId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Source research result not found" });
  }

  if (!row.qualified) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only historically profitable research results can be attached as replay evidence",
    });
  }

  assertResearchReplayConfigMatches(row, config);
  assertResearchReplayWindowMatches(row, config);
  assertResearchExecutionConfigMatches(config);

  const testMetrics = parseJsonValue<Record<string, unknown>>(row.testMetrics, {});
  const benchmark = parseJsonValue<Record<string, unknown>>(testMetrics["benchmark"], {});
  const excessReturn = numberMetric(testMetrics["excessReturn"]);
  const benchmarkReturn = numberMetric(benchmark["totalReturn"]);
  const benchmarkBeat = excessReturn !== null && excessReturn > 0;
  const alphaQualified = Boolean(row.qualified && benchmarkBeat);

  return {
    sourceType: "research" as const,
    sourceId: row.id,
    sourceLabel: `${row.strategyName} · ${row.timeframe}`,
    strategy: row.strategy,
    strategyName: row.strategyName,
    timeframe: row.timeframe,
    paramHash: row.paramHash,
    qualified: row.qualified,
    alphaQualified,
    paperBotEligible: alphaQualified,
    benchmarkStatus: alphaQualified
      ? "alpha-qualified"
      : row.qualified
        ? "profit-only"
        : benchmarkBeat
          ? "benchmark-beater"
          : "research",
    outOfSampleReturn: toNumber(row.outOfSampleReturn),
    benchmarkReturn,
    excessReturn,
    maxDrawdown: toNumber(row.maxDrawdown),
    sharpeRatio: toNumber(row.sharpeRatio),
    profitFactor: toNumber(row.profitFactor),
    totalTrades: toNumber(row.totalTrades),
    initialBalance: RESEARCH_EXECUTION_DEFAULTS.initialBalance,
    fees: RESEARCH_EXECUTION_DEFAULTS.fees,
    slippage: RESEARCH_EXECUTION_DEFAULTS.slippage,
    verifiedAt: Date.now(),
  };
}

function assertResearchExecutionConfigMatches(config: {
  initialBalance: number;
  fees: { maker: number; taker: number };
  slippage: { enabled: boolean; percentage: number };
}) {
  const mismatches: string[] = [];
  const expected = RESEARCH_EXECUTION_DEFAULTS;

  if (!numberEquals(config.initialBalance, expected.initialBalance)) {
    mismatches.push(
      `initialBalance ${config.initialBalance} does not match ${expected.initialBalance}`
    );
  }

  if (!numberEquals(config.fees.maker, expected.fees.maker)) {
    mismatches.push(`maker fee ${config.fees.maker} does not match ${expected.fees.maker}`);
  }

  if (!numberEquals(config.fees.taker, expected.fees.taker)) {
    mismatches.push(`taker fee ${config.fees.taker} does not match ${expected.fees.taker}`);
  }

  if (config.slippage.enabled !== expected.slippage.enabled) {
    mismatches.push(
      `slippage enabled ${String(config.slippage.enabled)} does not match ${String(expected.slippage.enabled)}`
    );
  }

  if (!numberEquals(config.slippage.percentage, expected.slippage.percentage)) {
    mismatches.push(
      `slippage ${config.slippage.percentage} does not match ${expected.slippage.percentage}`
    );
  }

  if (mismatches.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Research provenance can only be attached to exact research replays: execution assumptions do not match source research: ${mismatches.join("; ")}`,
    });
  }
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

function numberMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberEquals(a: number, b: number) {
  return Math.abs(a - b) < 1e-12;
}

export function buildBacktestCompareRun(row: typeof backtests.$inferSelect) {
  const initialBalance = toNumber(row.initialBalance);

  const stored = parseJsonValue<{
    result?: {
      equityCurve?: { time: number; equity: number }[];
      benchmark?: {
        totalReturn?: number;
        finalBalance?: number;
        maxDrawdown?: number;
      };
      excessReturn?: number;
      drawdownAdvantage?: number;
    };
  }>(row.metrics, {});

  const storedCurve = stored.result?.equityCurve ?? [];
  const equityCurve: { t: string; balance: number }[] =
    storedCurve.length > 0
      ? storedCurve.map((pt) => ({
          t: new Date(pt.time).toISOString(),
          balance: pt.equity,
        }))
      : [{ t: row.startTime.toISOString(), balance: initialBalance }];

  const benchmark = stored.result?.benchmark;

  return {
    backtestId: row.id,
    name: row.name,
    strategy: row.strategy,
    symbol: row.symbol,
    timeframe: row.timeframe,
    initialBalance,
    finalBalance: toNumber(row.finalBalance),
    totalPnl: toNumber(row.totalPnl),
    totalReturn: toNumber(row.totalPnlPercent),
    maxDrawdown: toNumber(row.maxDrawdown),
    sharpeRatio: toNumber(row.sharpeRatio),
    profitFactor: toNumber(row.profitFactor),
    benchmarkReturn: numberMetric(benchmark?.totalReturn),
    benchmarkFinalBalance: numberMetric(benchmark?.finalBalance),
    benchmarkMaxDrawdown: numberMetric(benchmark?.maxDrawdown),
    excessReturn: numberMetric(stored.result?.excessReturn),
    drawdownAdvantage: numberMetric(stored.result?.drawdownAdvantage),
    equityCurve,
  };
}
