import { backtests, botLogs, botTrades, bots, researchResults, type Database } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { z } from "zod";

import { BOT_JOB_NAMES } from "../../queues/types";
import { RESEARCH_EXECUTION_ASSUMPTIONS } from "../../services/researchEngine";
import {
  assertBacktestReplayConfigMatches,
  assertResearchReplayConfigMatches,
  canonicalJsonEqual,
  type ResearchReplayConfig,
} from "../../services/researchProvenance";
import { getStrategyCatalog } from "../../services/strategyCatalog";
import { AppErrorCode } from "../../utils/errors";
import { jobEnqueuedCounter } from "../../utils/metrics";
import { parseJsonValue, toNumber } from "../../utils/serialization";
import { botConfigSchema, riskConfigSchema, uuidSchema } from "../schemas";
import { createTrpcRouter, protectedProcedure, publicProcedure } from "../trpc";

const botStatusFilterSchema = z.object({
  status: z.enum(["all", "running", "paused", "stopped", "starting", "idle", "error"]).optional(),
  exchange: z.string().optional(),
});

type PromotionExecutionAssumptions = {
  marketMode: string;
  initialBalance: number;
  fees: {
    maker: number;
    taker: number;
  };
  slippage: {
    enabled: boolean;
    percentage: number;
  };
};

export const botsRouter = createTrpcRouter({
  list: publicProcedure.input(botStatusFilterSchema.default({})).query(async ({ ctx, input }) => {
    const conditions = [isNull(bots.deletedAt)];

    if (input.status && input.status !== "all") {
      conditions.push(eq(bots.status, input.status));
    }

    if (input.exchange) {
      conditions.push(eq(bots.exchange, input.exchange));
    }

    const rows = await ctx.db
      .select()
      .from(bots)
      .where(and(...conditions))
      .orderBy(desc(bots.createdAt));

    return rows.map(serializeBot);
  }),

  getById: publicProcedure.input(z.object({ botId: uuidSchema })).query(async ({ ctx, input }) => {
    const row = await findBot(ctx.db, input.botId);
    return serializeBot(row);
  }),

  create: protectedProcedure.input(botConfigSchema).mutation(async ({ ctx, input }) => {
    validateStrategy(input.strategy);
    const promotionEvidence = await resolvePromotionEvidence(
      ctx.db,
      input.promotionEvidence,
      input.mode,
      input
    );
    const currentBalance = evidenceInitialBalance(promotionEvidence) ?? input.currentBalance;

    const inserted = await ctx.db
      .insert(bots)
      .values({
        name: input.name,
        strategy: input.strategy,
        strategyParams: input.strategyParams,
        exchange: input.exchange,
        symbol: input.symbol,
        timeframe: input.timeframe,
        mode: input.mode,
        riskConfig: input.riskConfig,
        promotionEvidence: promotionEvidence ?? {},
        currentBalance: currentBalance?.toString(),
        status: "idle",
      })
      .returning();

    return serializeBot(inserted[0]!);
  }),

  update: protectedProcedure
    .input(z.object({ botId: uuidSchema, config: botConfigSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const row = await findBot(ctx.db, input.botId);
      ensureEditable(row.status);

      if (input.config.strategy) {
        validateStrategy(input.config.strategy);
      }

      if (input.config.mode === "live" && hasPromotionSource(row.promotionEvidence)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Evidence-promoted bots must remain in paper mode until a live promotion workflow is implemented",
        });
      }

      if (!input.config.promotionEvidence && hasPromotionSource(row.promotionEvidence)) {
        assertEvidenceBoundConfigUnchanged(row, input.config);
      }

      const promotionEvidence = input.config.promotionEvidence
        ? await resolvePromotionEvidence(
            ctx.db,
            input.config.promotionEvidence,
            input.config.mode ?? row.mode,
            {
              exchange: input.config.exchange ?? row.exchange,
              strategy: input.config.strategy ?? row.strategy,
              strategyParams: input.config.strategyParams ?? parseJsonValue(row.strategyParams, {}),
              symbol: input.config.symbol ?? row.symbol,
              timeframe: input.config.timeframe ?? row.timeframe,
            }
          )
        : undefined;

      const updated = await ctx.db
        .update(bots)
        .set({
          name: input.config.name ?? row.name,
          strategy: input.config.strategy ?? row.strategy,
          strategyParams: input.config.strategyParams ?? row.strategyParams,
          exchange: input.config.exchange ?? row.exchange,
          symbol: input.config.symbol ?? row.symbol,
          timeframe: input.config.timeframe ?? row.timeframe,
          mode: input.config.mode ?? row.mode,
          riskConfig:
            input.config.riskConfig ?? parseJsonValue(row.riskConfig, riskConfigSchema.parse({})),
          promotionEvidence: promotionEvidence ?? row.promotionEvidence,
          currentBalance:
            input.config.currentBalance != null
              ? input.config.currentBalance.toString()
              : row.currentBalance,
          updatedAt: new Date(),
        })
        .where(and(eq(bots.id, input.botId), eq(bots.status, row.status)))
        .returning();

      if (updated.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Bot changed while the update was in progress",
        });
      }

      return serializeBot(updated[0]!);
    }),

  start: protectedProcedure
    .input(z.object({ botId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const row = await findBot(ctx.db, input.botId);
      if (["running", "starting"].includes(row.status)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Bot already running",
          cause: { appCode: AppErrorCode.BOT_ALREADY_RUNNING },
        });
      }

      const updated = await ctx.db
        .update(bots)
        .set({
          status: "starting",
          startedAt: new Date(),
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(and(eq(bots.id, input.botId), eq(bots.status, row.status)))
        .returning();

      if (updated.length === 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Bot state changed before start" });
      }

      if (process.env["APP_MODE"] === "testing") {
        await ctx.db
          .update(bots)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(bots.id, input.botId));
        await ctx.redis.publish(
          "bot:status",
          JSON.stringify({ botId: input.botId, status: "running", timestamp: Date.now() })
        );
        return { success: true, jobId: "testing-mode" };
      }

      const jobId = `bot-${input.botId}-start-${Date.now()}`;
      let queuedJobId: string | undefined;
      try {
        const job = await ctx.queues.botExecutionQueue.add(
          BOT_JOB_NAMES.START,
          { botId: input.botId },
          {
            jobId,
            removeOnFail: false,
            removeOnComplete: false,
          }
        );
        queuedJobId = job.id;
        jobEnqueuedCounter.inc({ queue: "botExecution" });
      } catch (error) {
        await ctx.db
          .update(bots)
          .set({
            status: row.status,
            errorMessage: row.errorMessage,
            startedAt: row.startedAt,
            updatedAt: new Date(),
          })
          .where(eq(bots.id, input.botId));
        const job = await ctx.queues.botExecutionQueue.getJob(jobId).catch(() => null);
        await job?.remove().catch(() => undefined);
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Failed to enqueue bot start job",
          cause: error,
        });
      }

      await ctx.redis
        .publish(
          "bot:status",
          JSON.stringify({ botId: input.botId, status: "starting", timestamp: Date.now() })
        )
        .catch((error) => {
          ctx.logger.warn({ err: error, botId: input.botId, status: "starting" }, "bot status");
        });

      return { success: true, jobId: queuedJobId };
    }),

  pause: protectedProcedure
    .input(z.object({ botId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const row = await findBot(ctx.db, input.botId);
      if (!["running", "starting"].includes(row.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Bot cannot be paused from status ${row.status}`,
        });
      }

      const updated = await ctx.db
        .update(bots)
        .set({ status: "paused", updatedAt: new Date() })
        .where(and(eq(bots.id, input.botId), eq(bots.status, row.status)))
        .returning();
      if (updated.length === 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Bot state changed before pause" });
      }

      if (process.env["APP_MODE"] !== "testing") {
        const jobId = `bot-${input.botId}-pause-${Date.now()}`;
        try {
          await ctx.queues.botExecutionQueue.add(
            BOT_JOB_NAMES.PAUSE,
            { botId: input.botId },
            { jobId }
          );
          jobEnqueuedCounter.inc({ queue: "botExecution" });
        } catch (error) {
          await ctx.db
            .update(bots)
            .set({ status: row.status, updatedAt: new Date() })
            .where(eq(bots.id, input.botId));
          const job = await ctx.queues.botExecutionQueue.getJob(jobId).catch(() => null);
          await job?.remove().catch(() => undefined);
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "Failed to enqueue bot pause job",
            cause: error,
          });
        }
      }

      await ctx.redis
        .publish(
          "bot:status",
          JSON.stringify({ botId: input.botId, status: "paused", timestamp: Date.now() })
        )
        .catch((error) => {
          ctx.logger.warn({ err: error, botId: input.botId, status: "paused" }, "bot status");
        });

      return { success: true };
    }),

  stop: protectedProcedure
    .input(z.object({ botId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const row = await findBot(ctx.db, input.botId);
      if (!["running", "paused"].includes(row.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Bot cannot be stopped from status ${row.status}`,
        });
      }

      const updated = await ctx.db
        .update(bots)
        .set({ status: "stopped", stoppedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(bots.id, input.botId), eq(bots.status, row.status)))
        .returning();
      if (updated.length === 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Bot state changed before stop" });
      }

      if (process.env["APP_MODE"] !== "testing") {
        const jobId = `bot-${input.botId}-stop-${Date.now()}`;
        try {
          await ctx.queues.botExecutionQueue.add(
            BOT_JOB_NAMES.STOP,
            { botId: input.botId },
            { jobId }
          );
          jobEnqueuedCounter.inc({ queue: "botExecution" });
        } catch (error) {
          await ctx.db
            .update(bots)
            .set({ status: row.status, stoppedAt: row.stoppedAt, updatedAt: new Date() })
            .where(eq(bots.id, input.botId));
          const job = await ctx.queues.botExecutionQueue.getJob(jobId).catch(() => null);
          await job?.remove().catch(() => undefined);
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "Failed to enqueue bot stop job",
            cause: error,
          });
        }
      }

      await ctx.redis
        .publish(
          "bot:status",
          JSON.stringify({ botId: input.botId, status: "stopped", timestamp: Date.now() })
        )
        .catch((error) => {
          ctx.logger.warn({ err: error, botId: input.botId, status: "stopped" }, "bot status");
        });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ botId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const row = await findBot(ctx.db, input.botId);
      ensureEditable(row.status);
      await ctx.db.update(bots).set({ deletedAt: new Date() }).where(eq(bots.id, input.botId));
      return { success: true };
    }),

  getMetrics: publicProcedure
    .input(z.object({ botId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const row = await findBot(ctx.db, input.botId);
      const trades = await ctx.db
        .select()
        .from(botTrades)
        .where(eq(botTrades.botId, input.botId))
        .orderBy(desc(botTrades.executedAt));
      const performance = buildBotPerformanceMetrics(row, trades);

      return {
        botId: row.id,
        status: row.status,
        ...performance,
        startedAt: row.startedAt?.toISOString() ?? null,
        lastTradeAt: trades[0]?.executedAt.toISOString() ?? null,
      };
    }),

  getTrades: publicProcedure
    .input(
      z.object({
        botId: uuidSchema,
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await findBot(ctx.db, input.botId);
      const trades = await ctx.db
        .select()
        .from(botTrades)
        .where(eq(botTrades.botId, input.botId))
        .orderBy(desc(botTrades.executedAt))
        .limit(input.limit)
        .offset(input.offset);

      return trades.map((trade) => ({
        ...trade,
        amount: toNumber(trade.amount),
        price: toNumber(trade.price),
        cost: toNumber(trade.cost),
        fee: toNumber(trade.fee),
        pnl: toNumber(trade.pnl),
        pnlPercent: toNumber(trade.pnlPercent),
        executedAt: trade.executedAt.toISOString(),
        createdAt: trade.createdAt?.toISOString() ?? null,
      }));
    }),

  getRecentTrades: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
    .query(async ({ ctx, input }) => {
      const trades = await ctx.db
        .select()
        .from(botTrades)
        .orderBy(desc(botTrades.executedAt))
        .limit(input.limit);

      return trades.map((trade) => ({
        ...trade,
        amount: toNumber(trade.amount),
        price: toNumber(trade.price),
        cost: toNumber(trade.cost),
        fee: toNumber(trade.fee),
        pnl: toNumber(trade.pnl),
        pnlPercent: toNumber(trade.pnlPercent),
        executedAt: trade.executedAt.toISOString(),
        createdAt: trade.createdAt?.toISOString() ?? null,
      }));
    }),

  getLogs: publicProcedure
    .input(
      z.object({
        botId: uuidSchema,
        limit: z.number().min(1).max(200).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await findBot(ctx.db, input.botId);
      const conditions = [eq(botLogs.botId, input.botId)];
      if (input.cursor) {
        conditions.push(lt(botLogs.createdAt, new Date(input.cursor)));
      }
      const rows = await ctx.db
        .select()
        .from(botLogs)
        .where(and(...conditions))
        .orderBy(desc(botLogs.createdAt))
        .limit(input.limit);

      const items = rows.map((row) => ({
        ...row,
        createdAt: row.createdAt?.toISOString() ?? null,
      }));

      const nextCursor =
        items.length === input.limit ? (items[items.length - 1]?.createdAt ?? null) : null;

      return { items, nextCursor };
    }),
});

async function findBot(db: Database, botId: string) {
  const rows = await db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), isNull(bots.deletedAt)))
    .limit(1);
  const row = rows[0];

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Bot not found",
      cause: { appCode: AppErrorCode.BOT_NOT_FOUND },
    });
  }

  return row;
}

function ensureEditable(status: string) {
  if (["running", "starting"].includes(status)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Stop the bot before editing or deleting it",
    });
  }
}

function validateStrategy(strategy: string) {
  const valid = getStrategyCatalog({ includeLegacy: true }).some((entry) => entry.key === strategy);
  if (!valid) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown strategy: ${strategy}` });
  }
}

function serializeBot(row: typeof bots.$inferSelect) {
  return {
    ...row,
    currentBalance: toNumber(row.currentBalance),
    totalPnl: toNumber(row.totalPnl),
    totalTrades: toNumber(row.totalTrades),
    winRate: toNumber(row.winRate),
    riskConfig: parseJsonValue(row.riskConfig, riskConfigSchema.parse({})),
    promotionEvidence: parseJsonValue(row.promotionEvidence, {}),
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    stoppedAt: row.stoppedAt?.toISOString() ?? null,
  };
}

function buildBotPerformanceMetrics(
  row: typeof bots.$inferSelect,
  trades: (typeof botTrades.$inferSelect)[]
) {
  const chronologicalTrades = [...trades].reverse();
  const realizedPnl = chronologicalTrades.reduce((sum, trade) => sum + toNumber(trade.pnl), 0);
  const storedPnl = toNumber(row.totalPnl);
  const totalPnl = chronologicalTrades.length > 0 ? realizedPnl : storedPnl;
  const currentBalance = toNumber(row.currentBalance);
  const startingBalance = Math.max(currentBalance - totalPnl, 0);
  const totalTrades = chronologicalTrades.length;
  const wins = chronologicalTrades.filter((trade) => toNumber(trade.pnl) > 0).length;
  const losses = chronologicalTrades.filter((trade) => toNumber(trade.pnl) < 0).length;
  const grossProfit = chronologicalTrades.reduce(
    (sum, trade) => sum + Math.max(toNumber(trade.pnl), 0),
    0
  );
  const grossLoss = Math.abs(
    chronologicalTrades.reduce((sum, trade) => sum + Math.min(toNumber(trade.pnl), 0), 0)
  );
  const averageTradePnl = totalTrades > 0 ? totalPnl / totalTrades : 0;
  const equityCurve = buildBotEquityCurve(row, chronologicalTrades, startingBalance);
  const drawdownCurve = buildBotDrawdownCurve(equityCurve);
  const maxDrawdown = drawdownCurve.reduce((max, point) => Math.max(max, point.drawdown), 0);

  return {
    currentBalance,
    startingBalance,
    totalPnl,
    totalPnlPercent: startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0,
    totalTrades,
    wins,
    losses,
    winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    averageTradePnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : wins > 0 ? null : 0,
    maxDrawdown,
    equityCurve,
    drawdownCurve,
  };
}

function buildBotEquityCurve(
  row: typeof bots.$inferSelect,
  trades: (typeof botTrades.$inferSelect)[],
  startingBalance: number
) {
  const startedAt = row.startedAt ?? row.createdAt ?? new Date();
  let runningBalance = startingBalance;
  const points = [{ time: startedAt.getTime(), equity: runningBalance }];

  for (const trade of trades) {
    runningBalance += toNumber(trade.pnl);
    points.push({
      time: trade.executedAt.getTime(),
      equity: runningBalance,
    });
  }

  return points;
}

function buildBotDrawdownCurve(equityCurve: { time: number; equity: number }[]) {
  let peak = equityCurve[0]?.equity ?? 0;
  return equityCurve.map((point) => {
    peak = Math.max(peak, point.equity);
    const drawdown = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    return { time: point.time, drawdown };
  });
}

async function resolvePromotionEvidence(
  db: Database,
  evidence: z.infer<typeof botConfigSchema>["promotionEvidence"],
  mode: string,
  config: ResearchReplayConfig
) {
  if (!evidence) return;

  if (mode !== "paper") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Promoted research/backtest configs must start as paper bots",
    });
  }

  if (evidence.sourceType === "research") {
    const rows = await db
      .select()
      .from(researchResults)
      .where(eq(researchResults.id, evidence.sourceId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Source research result not found" });
    }

    if (!row.qualified) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Research result is not historically profitable enough for paper bot promotion",
      });
    }
    if (!researchResultBeatsBenchmark(row)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Research result must pass benchmark-alpha before paper bot promotion; keep profit-only rows in research review",
      });
    }
    assertResearchReplayConfigMatches(row, config);
    return buildResearchPromotionEvidence(row);
  }

  const rows = await db
    .select()
    .from(backtests)
    .where(and(eq(backtests.id, evidence.sourceId), isNull(backtests.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Source backtest not found" });
  }
  if (row.status !== "completed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only completed backtests can be promoted to paper bots",
    });
  }
  assertBacktestReplayConfigMatches(row, config);
  return buildBacktestPromotionEvidence(row);
}

function buildResearchPromotionEvidence(row: typeof researchResults.$inferSelect) {
  const testMetrics = parseJsonValue<Record<string, unknown>>(row.testMetrics, {});
  const benchmark = parseJsonValue<Record<string, unknown>>(testMetrics["benchmark"], {});
  const benchmarkReturn = numberMetric(benchmark["totalReturn"]);
  const excessReturn = numberMetric(testMetrics["excessReturn"]);
  const benchmarkBeat = excessReturn !== null && excessReturn > 0;
  const alphaQualified = Boolean(row.qualified && benchmarkBeat);
  const executionAssumptions = readExecutionAssumptions(
    testMetrics["executionAssumptions"],
    row.marketMode
  );

  return {
    sourceType: "research" as const,
    sourceId: row.id,
    sourceSweepId: row.sweepId,
    sourceLabel: `${row.strategyName} · ${row.timeframe}`,
    benchmarkStatus: alphaQualified
      ? "alpha-qualified"
      : row.qualified
        ? "profit-only"
        : benchmarkBeat
          ? "benchmark-beater"
          : "research",
    alphaQualified,
    paperBotEligible: alphaQualified,
    executionAssumptions,
    outOfSampleReturn: toNumber(row.outOfSampleReturn),
    benchmarkReturn: benchmarkReturn ?? undefined,
    excessReturn: excessReturn ?? undefined,
    maxDrawdown: toNumber(row.maxDrawdown),
    sharpeRatio: toNumber(row.sharpeRatio),
    profitFactor: toNumber(row.profitFactor),
    totalTrades: toNumber(row.totalTrades),
    verifiedAt: Date.now(),
  };
}

function researchResultBeatsBenchmark(row: typeof researchResults.$inferSelect) {
  const testMetrics = parseJsonValue<Record<string, unknown>>(row.testMetrics, {});
  const excessReturn = numberMetric(testMetrics["excessReturn"]);
  return excessReturn !== null && excessReturn > 0;
}

function buildBacktestPromotionEvidence(row: typeof backtests.$inferSelect) {
  const metrics = parseJsonValue<Record<string, unknown>>(row.metrics, {});
  const result = parseJsonValue<Record<string, unknown>>(metrics["result"], {});
  const benchmark = parseJsonValue<Record<string, unknown>>(result["benchmark"], {});
  const benchmarkReturn = numberMetric(benchmark["totalReturn"]);
  const excessReturn = numberMetric(result["excessReturn"]);
  const benchmarkBeat = excessReturn !== null && excessReturn > 0;
  const executionAssumptions = readBacktestExecutionAssumptions(row, metrics);

  return {
    sourceType: "backtest" as const,
    sourceId: row.id,
    sourceLabel: `${row.strategy} · ${row.symbol} · ${row.timeframe}`,
    benchmarkStatus: benchmarkBeat ? "benchmark-beater" : "research",
    executionAssumptions,
    outOfSampleReturn: toNumber(row.totalPnlPercent),
    benchmarkReturn: benchmarkReturn ?? undefined,
    excessReturn: excessReturn ?? undefined,
    maxDrawdown: toNumber(row.maxDrawdown),
    sharpeRatio: toNumber(row.sharpeRatio),
    profitFactor: toNumber(row.profitFactor),
    totalTrades: row.totalTrades ?? 0,
    verifiedAt: Date.now(),
  };
}

function numberMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function evidenceInitialBalance(evidence: unknown) {
  const record = parseJsonValue<{ executionAssumptions?: { initialBalance?: unknown } }>(
    evidence,
    {}
  );
  return numberMetric(record.executionAssumptions?.initialBalance);
}

function readExecutionAssumptions(
  value: unknown,
  fallbackMarketMode: string = RESEARCH_EXECUTION_ASSUMPTIONS.marketMode
): PromotionExecutionAssumptions {
  const record = parseJsonValue<Record<string, unknown>>(value, {});
  const fees = parseJsonValue<Record<string, unknown>>(record["fees"], {});
  const slippage = parseJsonValue<Record<string, unknown>>(record["slippage"], {});
  const marketMode =
    typeof record["marketMode"] === "string" && record["marketMode"].trim().length > 0
      ? record["marketMode"]
      : fallbackMarketMode;

  return {
    marketMode,
    initialBalance:
      numberMetric(record["initialBalance"]) ?? RESEARCH_EXECUTION_ASSUMPTIONS.initialBalance,
    fees: {
      maker: numberMetric(fees["maker"]) ?? RESEARCH_EXECUTION_ASSUMPTIONS.fees.maker,
      taker: numberMetric(fees["taker"]) ?? RESEARCH_EXECUTION_ASSUMPTIONS.fees.taker,
    },
    slippage: {
      enabled:
        typeof slippage["enabled"] === "boolean"
          ? slippage["enabled"]
          : RESEARCH_EXECUTION_ASSUMPTIONS.slippage.enabled,
      percentage:
        numberMetric(slippage["percentage"]) ?? RESEARCH_EXECUTION_ASSUMPTIONS.slippage.percentage,
    },
  };
}

function readBacktestExecutionAssumptions(
  row: typeof backtests.$inferSelect,
  metrics: Record<string, unknown>
): PromotionExecutionAssumptions {
  const fees = parseJsonValue<Record<string, unknown>>(metrics["fees"], {});
  const slippage = parseJsonValue<Record<string, unknown>>(metrics["slippage"], {});

  return {
    marketMode: RESEARCH_EXECUTION_ASSUMPTIONS.marketMode,
    initialBalance: toNumber(row.initialBalance, RESEARCH_EXECUTION_ASSUMPTIONS.initialBalance),
    fees: {
      maker: numberMetric(fees["maker"]) ?? RESEARCH_EXECUTION_ASSUMPTIONS.fees.maker,
      taker: numberMetric(fees["taker"]) ?? RESEARCH_EXECUTION_ASSUMPTIONS.fees.taker,
    },
    slippage: {
      enabled:
        typeof slippage["enabled"] === "boolean"
          ? slippage["enabled"]
          : RESEARCH_EXECUTION_ASSUMPTIONS.slippage.enabled,
      percentage:
        numberMetric(slippage["percentage"]) ?? RESEARCH_EXECUTION_ASSUMPTIONS.slippage.percentage,
    },
  };
}

function hasPromotionSource(value: unknown) {
  const evidence = parseJsonValue<{ sourceType?: unknown; sourceId?: unknown }>(value, {});
  return (
    (evidence.sourceType === "research" || evidence.sourceType === "backtest") &&
    typeof evidence.sourceId === "string"
  );
}

function assertEvidenceBoundConfigUnchanged(
  row: typeof bots.$inferSelect,
  config: Partial<z.infer<typeof botConfigSchema>>
) {
  const changedFields: string[] = [];

  if (config.exchange !== undefined && config.exchange !== row.exchange) {
    changedFields.push("exchange");
  }

  if (config.strategy !== undefined && config.strategy !== row.strategy) {
    changedFields.push("strategy");
  }

  if (config.symbol !== undefined && config.symbol !== row.symbol) {
    changedFields.push("symbol");
  }

  if (config.timeframe !== undefined && config.timeframe !== row.timeframe) {
    changedFields.push("timeframe");
  }

  if (
    config.strategyParams !== undefined &&
    !canonicalJsonEqual(config.strategyParams, parseJsonValue(row.strategyParams, {}))
  ) {
    changedFields.push("strategyParams");
  }

  if (changedFields.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Evidence-promoted bots cannot change evidence-bound config without validated new promotion evidence: ${changedFields.join(", ")}`,
    });
  }
}
