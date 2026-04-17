import { z } from "zod";

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

export const botConfigSchema = z.object({
  name: z.string().min(1).max(120),
  strategy: z.string().min(1),
  strategyParams: z.record(z.unknown()).default({}),
  exchange: z.string().min(1),
  symbol: z.string().min(3),
  timeframe: z.string().min(1),
  mode: z.enum(["backtest", "paper", "live"]).default("paper"),
  riskConfig: riskConfigSchema.default(riskConfigSchema.parse({})),
  currentBalance: z.number().positive().optional(),
});

export const backtestConfigSchema = z.object({
  name: z.string().min(1).max(120),
  strategy: z.string().min(1),
  strategyParams: z.record(z.unknown()).default({}),
  exchange: z.string().min(1),
  symbol: z.string().min(3),
  timeframe: z.string().min(1),
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
});

export const exchangeCreateSchema = z.object({
  exchange: z.string().min(1),
  name: z.string().min(1).max(120),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  passphrase: z.string().optional(),
  testnet: z.boolean().default(false),
});

export const dataExportSchema = z.object({
  exchange: z.string().min(1),
  symbols: z.array(z.string().min(1)).min(1),
  timeframe: z.string().min(1),
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive(),
  format: z.enum(["csv", "parquet", "sqlite"]),
  compress: z.boolean().default(true),
  compressionFormat: z.enum(["gzip", "zstd"]).default("gzip"),
});
