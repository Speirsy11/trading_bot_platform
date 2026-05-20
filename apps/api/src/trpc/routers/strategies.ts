import { z } from "zod";

import { getStrategyCatalog } from "../../services/strategyCatalog";
import { backtestConfigSchema, botConfigSchema } from "../schemas";
import { createTrpcRouter, publicProcedure } from "../trpc";

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
    id: "balanced-rsi-reversion",
    name: "Balanced RSI Reversion",
    strategy: "rsi-mean-reversion",
    description: "Buy oversold pullbacks and exit when momentum normalises.",
    strategyParams: { period: 14, oversold: 30, overbought: 70 },
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
    name: "Bollinger Bounce Paper-first",
    strategy: "bollinger-bounce",
    description: "Mean-reversion template intended to prove behaviour in paper mode first.",
    strategyParams: { period: 20, stdDevMultiplier: 2 },
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
});

function buildConfigWarnings(mode: string, riskConfig: { riskPerTradePercent: number; maxPositionSizePercent: number; maxDailyLossPercent: number }) {
  const warnings: string[] = [];
  if (mode === "live") {
    warnings.push("Live mode can place real exchange orders. Start in paper mode first.");
  }
  if (riskConfig.riskPerTradePercent > 3) {
    warnings.push("Risk per trade is above 3%; this is aggressive for unattended bots.");
  }
  if (riskConfig.maxPositionSizePercent > 10) {
    warnings.push("Max position size is above 10%; consider lowering it until the strategy is proven.");
  }
  if (riskConfig.maxDailyLossPercent > 5) {
    warnings.push("Daily loss limit is above 5%; tighter loss caps are safer for live automation.");
  }
  return warnings;
}
