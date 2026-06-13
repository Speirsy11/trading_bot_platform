import { z } from "zod";

import { normalizeMarketSymbol, uniqueStrings } from "../utils/symbols";

export const uuidSchema = z.string().uuid();

export const riskConfigSchema = z.object({
  maxPositionSizePercent: z.number().positive().default(10),
  maxDrawdownPercent: z.number().positive().default(20),
  riskPerTradePercent: z.number().positive().default(2),
  maxConcurrentPositions: z.number().int().positive().default(5),
  maxDailyLossPercent: z.number().positive().default(5),
  trailingStopEnabled: z.boolean().default(false),
  trailingStopPercent: z.number().positive().default(5),
});

export const executionAssumptionsSchema = z.object({
  marketMode: z.string().min(1),
  initialBalance: z.number().positive(),
  fees: z.object({
    maker: z.number().nonnegative(),
    taker: z.number().nonnegative(),
  }),
  slippage: z.object({
    enabled: z.boolean(),
    percentage: z.number().nonnegative(),
  }),
});

export const botPromotionEvidenceSchema = z
  .object({
    sourceType: z.enum(["research", "backtest"]),
    sourceId: uuidSchema,
    sourceSweepId: uuidSchema.optional(),
    sourceLabel: z.string().max(160).optional(),
    benchmarkStatus: z.string().max(80).optional(),
    alphaQualified: z.boolean().optional(),
    paperBotEligible: z.boolean().optional(),
    executionAssumptions: executionAssumptionsSchema.optional(),
    outOfSampleReturn: z.number().optional(),
    benchmarkReturn: z.number().optional(),
    excessReturn: z.number().optional(),
    maxDrawdown: z.number().optional(),
    sharpeRatio: z.number().optional(),
    profitFactor: z.number().optional(),
    totalTrades: z.number().optional(),
    verifiedAt: z.number().int().positive().optional(),
  })
  .optional();

export const botConfigSchema = z.object({
  name: z.string().min(1).max(120),
  strategy: z.string().min(1),
  strategyParams: z.record(z.unknown()).default({}),
  exchange: z.string().min(1),
  symbol: z.string().min(3),
  timeframe: z.string().min(1),
  mode: z.enum(["backtest", "paper", "live"]).default("paper"),
  riskConfig: riskConfigSchema.default(riskConfigSchema.parse({})),
  promotionEvidence: botPromotionEvidenceSchema,
  currentBalance: z.number().positive().optional(),
});

export const backtestConfigSchema = z
  .object({
    name: z.string().min(1).max(120),
    strategy: z.string().min(1),
    strategyParams: z.record(z.unknown()).default({}),
    exchange: z.string().min(1),
    symbol: z.string().min(3),
    timeframe: z.string().min(1),
    sourceResearch: uuidSchema.optional(),
    startTime: z.number().int().positive(),
    endTime: z.number().int().positive(),
    initialBalance: z.number().positive(),
    riskConfig: riskConfigSchema.default(riskConfigSchema.parse({})),
    fees: z
      .object({
        maker: z.number().nonnegative().default(0.001),
        taker: z.number().nonnegative().default(0.001),
      })
      .default({ maker: 0.001, taker: 0.001 }),
    slippage: z
      .object({
        enabled: z.boolean().default(true),
        percentage: z.number().nonnegative().default(0.0005),
      })
      .default({ enabled: true, percentage: 0.0005 }),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const exchangeCreateSchema = z.object({
  exchange: z.string().min(1),
  name: z.string().min(1).max(120),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  passphrase: z.string().optional(),
  testnet: z.boolean().default(false),
});

export const dataExportSchema = z
  .object({
    exchange: z.string().min(1),
    symbols: z
      .array(z.string().trim().min(1).transform(normalizeMarketSymbol))
      .min(1)
      .transform(uniqueStrings),
    timeframe: z.enum(["1m", "15m", "1h", "4h"]),
    startTime: z.number().int().positive(),
    endTime: z.number().int().positive(),
    format: z.enum(["csv", "parquet", "sqlite"]),
    compress: z.boolean().default(true),
    compressionFormat: z.enum(["gzip", "zstd"]).default("gzip"),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });
