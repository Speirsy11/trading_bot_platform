import { botLogs, botTrades, bots, type Database } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { z } from "zod";

import { BOT_JOB_NAMES } from "../../queues/types";
import { getStrategyCatalog } from "../../services/strategyCatalog";
import { AppErrorCode } from "../../utils/errors";
import { parseJsonValue, toNumber } from "../../utils/serialization";
import { botConfigSchema, riskConfigSchema, uuidSchema } from "../schemas";
import { createTrpcRouter, protectedProcedure, publicProcedure } from "../trpc";

const botStatusFilterSchema = z.object({
  status: z.enum(["all", "running", "paused", "stopped", "starting", "idle", "error"]).optional(),
  exchange: z.string().optional(),
});

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
        currentBalance: input.currentBalance?.toString(),
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

      try {
        const job = await ctx.queues.botExecutionQueue.add(
          BOT_JOB_NAMES.START,
          { botId: input.botId },
          {
            jobId: `bot-${input.botId}-start-${Date.now()}`,
            removeOnFail: false,
            removeOnComplete: false,
          }
        );

        await ctx.redis.publish(
          "bot:status",
          JSON.stringify({ botId: input.botId, status: "starting", timestamp: Date.now() })
        );

        return { success: true, jobId: job.id };
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
        throw error;
      }
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

      await ctx.db
        .update(bots)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(bots.id, input.botId));
      await ctx.queues.botExecutionQueue.add(
        BOT_JOB_NAMES.PAUSE,
        { botId: input.botId },
        { jobId: `bot-${input.botId}-pause-${Date.now()}` }
      );
      await ctx.redis.publish(
        "bot:status",
        JSON.stringify({ botId: input.botId, status: "paused", timestamp: Date.now() })
      );

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

      await ctx.db
        .update(bots)
        .set({ status: "stopped", stoppedAt: new Date(), updatedAt: new Date() })
        .where(eq(bots.id, input.botId));
      await ctx.queues.botExecutionQueue.add(
        BOT_JOB_NAMES.STOP,
        { botId: input.botId },
        { jobId: `bot-${input.botId}-stop-${Date.now()}` }
      );
      await ctx.redis.publish(
        "bot:status",
        JSON.stringify({ botId: input.botId, status: "stopped", timestamp: Date.now() })
      );

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
      const totalTrades = trades.length;
      const wins = trades.filter((trade) => toNumber(trade.pnl) > 0).length;
      const losses = trades.filter((trade) => toNumber(trade.pnl) < 0).length;
      const averageTradePnl =
        totalTrades > 0
          ? trades.reduce((sum, trade) => sum + toNumber(trade.pnl), 0) / totalTrades
          : 0;

      return {
        botId: row.id,
        status: row.status,
        currentBalance: toNumber(row.currentBalance),
        totalPnl: toNumber(row.totalPnl),
        totalTrades,
        wins,
        losses,
        winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
        averageTradePnl,
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
  const valid = getStrategyCatalog().some((entry) => entry.key === strategy);
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
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    stoppedAt: row.stoppedAt?.toISOString() ?? null,
  };
}
