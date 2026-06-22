import { strategyDrafts, type Database } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { getStrategyCatalog } from "../../services/strategyCatalog";
import { backtestConfigSchema, botConfigSchema, riskConfigSchema, uuidSchema } from "../schemas";
import { createTrpcRouter, publicProcedure } from "../trpc";

const strategyDraftInputSchema = z.object({
  name: z.string().min(1).max(120),
  strategy: z.string().min(1),
  strategyParams: z.record(z.unknown()).default({}),
  riskConfig: riskConfigSchema.default(riskConfigSchema.parse({})),
  exchange: z.string().min(1).default("binance"),
  symbol: z.string().min(3).default("BTC/USDT"),
  timeframe: z.string().min(1).default("1h"),
  notes: z.string().max(1000).optional(),
});

const STRATEGY_PRESETS = [
  {
    id: "conservative-sma",
    name: "Conservative SMA Trend",
    strategy: "sma-crossover",
    description: "Slower moving-average crossover for steadier markets and fewer trades.",
    strategyParams: { fastPeriod: 20, slowPeriod: 50 },
    riskConfig: {
      maxPositionSizePercent: 5,
      maxDrawdownPercent: 10,
      riskPerTradePercent: 1,
      maxConcurrentPositions: 1,
      maxDailyLossPercent: 3,
      trailingStopEnabled: true,
      trailingStopPercent: 3,
    },
    recommendedTimeframes: ["1h", "4h", "1d"],
  },
  {
    id: "sma-chandelier-paper-first",
    name: "SMA Chandelier Paper-first",
    strategy: "sma-chandelier-trend",
    description:
      "Spot long-only SMA trend template with ATR chandelier exits for drawdown-controlled trend following.",
    strategyParams: {
      fastPeriod: 50,
      slowPeriod: 200,
      exitPeriod: 22,
      atrPeriod: 14,
      atrStop: 3,
    },
    riskConfig: {
      maxPositionSizePercent: 5,
      maxDrawdownPercent: 12,
      riskPerTradePercent: 1,
      maxConcurrentPositions: 1,
      maxDailyLossPercent: 3,
      trailingStopEnabled: true,
      trailingStopPercent: 3,
    },
    recommendedTimeframes: ["1h", "4h", "1d"],
  },
  {
    id: "balanced-rsi-reversion",
    name: "Balanced RSI Reversion",
    strategy: "rsi-mean-reversion",
    description: "Buy oversold pullbacks and exit when momentum normalises.",
    strategyParams: { rsiPeriod: 14, oversoldLevel: 30, overboughtLevel: 60 },
    riskConfig: {
      maxPositionSizePercent: 8,
      maxDrawdownPercent: 15,
      riskPerTradePercent: 1.5,
      maxConcurrentPositions: 2,
      maxDailyLossPercent: 5,
      trailingStopEnabled: false,
      trailingStopPercent: 5,
    },
    recommendedTimeframes: ["15m", "1h", "4h"],
  },
  {
    id: "bollinger-scalp-paper-first",
    name: "Bollinger Long Bounce Paper-first",
    strategy: "bollinger-long-bounce",
    description:
      "Spot long-only mean-reversion template intended to prove behaviour in paper mode first.",
    strategyParams: { period: 20, stdDevMultiplier: 2, rsiOversold: 35, exitBand: "middle" },
    riskConfig: {
      maxPositionSizePercent: 3,
      maxDrawdownPercent: 8,
      riskPerTradePercent: 0.75,
      maxConcurrentPositions: 1,
      maxDailyLossPercent: 2,
      trailingStopEnabled: true,
      trailingStopPercent: 2,
    },
    recommendedTimeframes: ["5m", "15m", "1h"],
  },
  {
    id: "macd-momentum-paper-first",
    name: "MACD Momentum Paper-first",
    strategy: "macd-momentum",
    description:
      "Spot long-only momentum template that enters when MACD recovers above trend and exits on momentum failure.",
    strategyParams: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      trendPeriod: 100,
      atrPeriod: 14,
      atrStop: 2,
    },
    riskConfig: {
      maxPositionSizePercent: 5,
      maxDrawdownPercent: 12,
      riskPerTradePercent: 1,
      maxConcurrentPositions: 1,
      maxDailyLossPercent: 3,
      trailingStopEnabled: true,
      trailingStopPercent: 3,
    },
    recommendedTimeframes: ["1h", "4h", "1d"],
  },
  {
    id: "chandelier-trend-paper-first",
    name: "Chandelier Trend Paper-first",
    strategy: "chandelier-trend",
    description:
      "Spot long-only breakout template that follows trend highs and exits on ATR chandelier breakdowns.",
    strategyParams: {
      entryPeriod: 55,
      exitPeriod: 22,
      trendPeriod: 200,
      atrPeriod: 14,
      atrStop: 3,
    },
    riskConfig: {
      maxPositionSizePercent: 5,
      maxDrawdownPercent: 12,
      riskPerTradePercent: 1,
      maxConcurrentPositions: 1,
      maxDailyLossPercent: 3,
      trailingStopEnabled: true,
      trailingStopPercent: 3,
    },
    recommendedTimeframes: ["1h", "4h", "1d"],
  },
] as const;

export const strategiesRouter = createTrpcRouter({
  catalog: publicProcedure.query(async () => ({
    strategies: getStrategyCatalog(),
    presets: STRATEGY_PRESETS,
    capabilities: [
      "Visual parameter editing",
      "Saved strategy presets",
      "Backtest before launch",
      "Paper/live deployment modes",
      "Risk limits and kill-switch compatible bot runtime",
    ],
  })),

  validateBacktestConfig: publicProcedure.input(backtestConfigSchema).mutation(({ input }) => ({
    valid: true,
    config: input,
    warnings: buildConfigWarnings("backtest", input.riskConfig),
  })),

  validateBotConfig: publicProcedure.input(botConfigSchema).mutation(({ input }) => ({
    valid: true,
    config: input,
    warnings: buildConfigWarnings(input.mode, input.riskConfig),
  })),

  explain: publicProcedure.input(z.object({ strategy: z.string() })).query(({ input }) => {
    const strategy = getStrategyCatalog().find((entry) => entry.key === input.strategy);
    if (!strategy) return null;
    return {
      ...strategy,
      workflow: [
        "Pick or clone a template",
        "Adjust parameters and risk limits",
        "Run a backtest on collected OHLCV candles",
        "Promote the exact config to paper mode",
        "Switch to live only after reviewing results and exchange credentials",
      ],
    };
  }),

  listDrafts: publicProcedure
    .input(z.object({ strategy: z.string().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const conditions = [isNull(strategyDrafts.deletedAt)];
      if (input.strategy) conditions.push(eq(strategyDrafts.strategy, input.strategy));

      const rows = await ctx.db
        .select()
        .from(strategyDrafts)
        .where(and(...conditions))
        .orderBy(desc(strategyDrafts.updatedAt), desc(strategyDrafts.createdAt));

      return rows.map(serializeStrategyDraft);
    }),

  createDraft: publicProcedure.input(strategyDraftInputSchema).mutation(async ({ ctx, input }) => {
    validateStrategy(input.strategy);

    const inserted = await ctx.db
      .insert(strategyDrafts)
      .values({
        name: input.name,
        strategy: input.strategy,
        strategyParams: input.strategyParams,
        riskConfig: input.riskConfig,
        exchange: input.exchange,
        symbol: input.symbol,
        timeframe: input.timeframe,
        notes: input.notes,
      })
      .returning();

    return serializeStrategyDraft(inserted[0]!);
  }),

  updateDraft: publicProcedure
    .input(z.object({ draftId: uuidSchema, patch: strategyDraftInputSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await findStrategyDraft(ctx.db, input.draftId);
      const strategy = input.patch.strategy ?? existing.strategy;
      validateStrategy(strategy);

      const updated = await ctx.db
        .update(strategyDrafts)
        .set({
          ...input.patch,
          strategy,
          updatedAt: new Date(),
        })
        .where(and(eq(strategyDrafts.id, input.draftId), isNull(strategyDrafts.deletedAt)))
        .returning();

      return serializeStrategyDraft(updated[0]!);
    }),

  deleteDraft: publicProcedure
    .input(z.object({ draftId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await findStrategyDraft(ctx.db, input.draftId);
      await ctx.db
        .update(strategyDrafts)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(strategyDrafts.id, input.draftId));
      return { success: true };
    }),
});

function buildConfigWarnings(
  mode: string,
  riskConfig: {
    riskPerTradePercent: number;
    maxPositionSizePercent: number;
    maxDailyLossPercent: number;
  }
) {
  const warnings: string[] = [];
  if (mode === "live") {
    warnings.push("Live mode can place real exchange orders. Start in paper mode first.");
  }
  if (riskConfig.riskPerTradePercent > 3) {
    warnings.push("Risk per trade is above 3%; this is aggressive for unattended bots.");
  }
  if (riskConfig.maxPositionSizePercent > 10) {
    warnings.push(
      "Max position size is above 10%; consider lowering it until the strategy is proven."
    );
  }
  if (riskConfig.maxDailyLossPercent > 5) {
    warnings.push("Daily loss limit is above 5%; tighter loss caps are safer for live automation.");
  }
  return warnings;
}

function validateStrategy(strategyKey: string) {
  const exists = getStrategyCatalog({ includeLegacy: true }).some(
    (entry) => entry.key === strategyKey
  );
  if (!exists) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown strategy: ${strategyKey}` });
  }
}

async function findStrategyDraft(db: Database, draftId: string) {
  const rows = await db
    .select()
    .from(strategyDrafts)
    .where(and(eq(strategyDrafts.id, draftId), isNull(strategyDrafts.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Strategy draft not found" });
  return row;
}

function serializeStrategyDraft(row: typeof strategyDrafts.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
