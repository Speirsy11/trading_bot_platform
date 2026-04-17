import { botTrades, bots, type Database } from "@tb/db";
import { and, eq, gte } from "drizzle-orm";

import { parseJsonValue, toNumber } from "./serialization";

/**
 * Returns the sum of realized PnL for the given bot since UTC midnight today.
 * Only negative sums are returned as-is; a profitable day returns 0.
 */
export async function getDailyPnL(db: Database, botId: string): Promise<number> {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const trades = await db
    .select({ pnl: botTrades.pnl })
    .from(botTrades)
    .where(and(eq(botTrades.botId, botId), gte(botTrades.executedAt, todayUtc)));

  const total = trades.reduce((sum, t) => sum + toNumber(t.pnl), 0);
  return total < 0 ? total : 0;
}

/**
 * Returns the configured daily loss limit in USD for the given bot.
 * Reads `dailyLossLimitUSD` from the bot's `riskConfig` JSONB column.
 * Falls back to the env var `DAILY_LOSS_LIMIT_USD`.
 * Returns Infinity if neither is set.
 */
export async function getDailyLossLimit(db: Database, botId: string): Promise<number> {
  const rows = await db
    .select({ riskConfig: bots.riskConfig })
    .from(bots)
    .where(eq(bots.id, botId))
    .limit(1);

  const riskConfig = parseJsonValue<Record<string, unknown>>(rows[0]?.riskConfig, {});
  const perBotLimit = riskConfig["dailyLossLimitUSD"];

  if (typeof perBotLimit === "number" && Number.isFinite(perBotLimit) && perBotLimit > 0) {
    return perBotLimit;
  }

  const envLimit = process.env["DAILY_LOSS_LIMIT_USD"];
  if (envLimit) {
    const parsed = Number(envLimit);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return Infinity;
}

/**
 * Returns true if the bot's realized loss today has exceeded its configured
 * daily loss limit.
 */
export async function hasExceededDailyLossLimit(db: Database, botId: string): Promise<boolean> {
  const [dailyPnL, limit] = await Promise.all([
    getDailyPnL(db, botId),
    getDailyLossLimit(db, botId),
  ]);

  if (!Number.isFinite(limit)) {
    return false;
  }

  // dailyPnL is <= 0; loss exceeds limit when the absolute loss > limit
  return -dailyPnL > limit;
}
