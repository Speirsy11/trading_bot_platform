import { randomUUID } from "node:crypto";

import { botLogs, bots, exchangeConfigs, type Database } from "@tb/db";
import {
  Bot as TradingBot,
  BotRunner,
  type IExchange,
  LiveExchange,
  PaperExchange,
  StrategyRegistry,
} from "@tb/trading-core";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import type IORedis from "ioredis";
import pino from "pino";

import { API_QUEUE_NAMES, BOT_JOB_NAMES, type BotJobData } from "../queues/types";
import type { ExchangeManager } from "../services/exchangeManager";
import { bootstrapStrategies } from "../services/strategyCatalog";
import { BalanceDropDetector, getBalanceDropThreshold } from "../utils/balanceDropDetector";
import { hasExceededDailyLossLimit } from "../utils/dailyLossCheck";
import { checkNotionalCap } from "../utils/notionalCap";
import { parseJsonValue, toNumber } from "../utils/serialization";

const logger = pino({ name: "botExecutor" });

interface BotRuntime {
  bot: TradingBot;
  runner: BotRunner;
}

/**
 * Wraps an exchange's createOrder to enforce MAX_NOTIONAL_USD cap on bot orders.
 * Violations are logged and the order is skipped (no throw) so the bot stays running.
 */
function wrapExchangeWithNotionalCap(exchange: IExchange, botId: string): IExchange {
  const original = exchange.createOrder.bind(exchange);
  exchange.createOrder = async (symbol, type, side, amount, price, stopPrice) => {
    try {
      checkNotionalCap(amount, price, type);
    } catch (e) {
      logger.warn(
        {
          botId,
          symbol,
          type,
          side,
          amount,
          price,
          cap: e instanceof Error ? e.message : String(e),
        },
        "Bot order blocked by notional cap"
      );
      // Return a synthetic rejected order so callers can handle gracefully
      return {
        id: "",
        symbol,
        type,
        side,
        amount,
        price: price ?? 0,
        average: 0,
        filled: 0,
        remaining: amount,
        status: "rejected",
        timestamp: Date.now(),
        fee: 0,
        cost: 0,
      } as never;
    }
    return original(symbol, type, side, amount, price, stopPrice);
  };
  return exchange;
}

export function createBotExecutorWorker(options: {
  db: Database;
  redis: IORedis;
  exchangeManager: ExchangeManager;
}) {
  bootstrapStrategies();
  const runtimes = new Map<string, BotRuntime>();

  return new Worker<BotJobData>(
    API_QUEUE_NAMES.BOT_EXECUTION,
    async (job) => {
      switch (job.name) {
        case BOT_JOB_NAMES.START:
          return withBotLock(options.redis, job.data.botId, () =>
            startBot(job.data.botId, options.db, options.redis, options.exchangeManager, runtimes)
          );
        case BOT_JOB_NAMES.PAUSE:
          return withBotLock(options.redis, job.data.botId, () =>
            pauseBot(job.data.botId, options.db, options.redis, runtimes)
          );
        case BOT_JOB_NAMES.STOP:
          return withBotLock(options.redis, job.data.botId, () =>
            stopBot(job.data.botId, options.db, options.redis, runtimes)
          );
        default:
          return null;
      }
    },
    {
      connection: options.redis.duplicate({ maxRetriesPerRequest: null }),
      concurrency: 10,
    }
  );
}

async function startBot(
  botId: string,
  db: Database,
  redis: IORedis,
  exchangeManager: ExchangeManager,
  runtimes: Map<string, BotRuntime>
) {
  const existing = runtimes.get(botId);
  if (existing) {
    return { status: "already-running" };
  }

  const botRow = (await db.select().from(bots).where(eq(bots.id, botId)).limit(1))[0];
  if (!botRow) {
    throw new Error(`Bot ${botId} not found`);
  }

  const fallbackStatus = botRow.status === "starting" ? "idle" : botRow.status;

  const strategy = StrategyRegistry.create(botRow.strategy);
  const runtimeExchange = wrapExchangeWithNotionalCap(
    await createRuntimeExchange(botRow, db, exchangeManager),
    botId
  );
  const tradingBot = new TradingBot(
    {
      id: botRow.id,
      name: botRow.name,
      symbol: botRow.symbol,
      timeframe: botRow.timeframe,
      strategyParams: parseJsonValue(botRow.strategyParams, {}),
      riskConfig: parseJsonValue(botRow.riskConfig, undefined),
      closePositionsOnStop: true,
    },
    strategy,
    runtimeExchange,
    {
      info: (message) => void logBot(db, botId, "info", message),
      warn: (message) => void logBot(db, botId, "warn", message),
      error: (message) => void logBot(db, botId, "error", message),
      debug: (message) => void logBot(db, botId, "debug", message),
    }
  );

  await tradingBot.start();

  // Fetch starting balance for catastrophic-drop detection.
  // Extract quote currency from the symbol (e.g. "BTC/USDT" → "USDT").
  // If the balance for that currency is unavailable, sum all total values.
  const quoteCurrency = botRow.symbol.includes("/") ? botRow.symbol.split("/")[1]! : "USDT";
  let startingBalance = 0;
  try {
    const startBalance = await runtimeExchange.fetchBalance();
    const quoted = startBalance.total[quoteCurrency];
    startingBalance =
      typeof quoted === "number" && quoted >= 0
        ? quoted
        : Object.values(startBalance.total).reduce((s, v) => s + (v ?? 0), 0);
  } catch {
    // Non-fatal: if we can't fetch the balance we skip catastrophic-drop detection.
    logger.warn(
      { botId },
      "Could not fetch starting balance — catastrophic-drop detection disabled"
    );
  }
  const riskConfig = parseJsonValue<Record<string, unknown>>(botRow.riskConfig, {});
  const dropThreshold = getBalanceDropThreshold(riskConfig);
  const balanceDropDetector =
    startingBalance > 0 ? new BalanceDropDetector(startingBalance, dropThreshold) : null;

  let runner: BotRunner | undefined;
  try {
    const afterCandle = async () => {
      // ── Daily loss limit check (LT-3) ───────────────────────────────────
      const exceeded = await hasExceededDailyLossLimit(db, botId).catch(() => false);
      if (exceeded) {
        logger.warn({ botId }, "Daily loss limit exceeded — bot auto-paused");
        await logBot(db, botId, "warn", "Daily loss limit exceeded — bot auto-paused");

        // Pause the in-process bot runner and update DB/Redis.
        // Fire-and-forget errors so we don't crash the interval loop.
        const runtime = runtimes.get(botId);
        if (runtime) {
          await runtime.bot.pause().catch(() => undefined);
          runtimes.delete(botId);
        }
        await db
          .update(bots)
          .set({ status: "paused", updatedAt: new Date() })
          .where(eq(bots.id, botId))
          .catch(() => undefined);
        await redis
          .publish(
            "bot:status",
            JSON.stringify({
              botId,
              status: "paused",
              reason: "daily_loss_limit_exceeded",
              timestamp: Date.now(),
            })
          )
          .catch(() => undefined);
        return;
      }

      // ── Catastrophic balance-drop check (LT-5) ──────────────────────────
      if (balanceDropDetector) {
        try {
          const currentBalanceSnapshot = await runtimeExchange.fetchBalance();
          const quoted = currentBalanceSnapshot.total[quoteCurrency];
          const currentBalance =
            typeof quoted === "number" && quoted >= 0
              ? quoted
              : Object.values(currentBalanceSnapshot.total).reduce((s, v) => s + (v ?? 0), 0);

          if (balanceDropDetector.check(currentBalance)) {
            const dropPercent = parseFloat(
              balanceDropDetector.dropPercent(currentBalance).toFixed(2)
            );
            logger.warn(
              { botId, dropPercent },
              "Catastrophic balance drop detected — bot auto-paused"
            );
            await logBot(
              db,
              botId,
              "warn",
              `Catastrophic balance drop detected (${dropPercent}%) — bot auto-paused`
            );

            const runtime = runtimes.get(botId);
            if (runtime) {
              await runtime.bot.pause().catch(() => undefined);
              runtimes.delete(botId);
            }
            await db
              .update(bots)
              .set({ status: "paused", updatedAt: new Date() })
              .where(eq(bots.id, botId))
              .catch(() => undefined);
            await redis
              .publish(
                "bot:status",
                JSON.stringify({
                  botId,
                  status: "paused",
                  reason: "catastrophic_balance_drop",
                  dropPercent,
                  timestamp: Date.now(),
                })
              )
              .catch(() => undefined);
          }
        } catch {
          // Non-fatal: balance fetch failed, skip check this interval.
        }
      }
    };

    runner = new BotRunner(
      tradingBot,
      runtimeExchange,
      botRow.symbol,
      botRow.timeframe,
      afterCandle
    );
    await runner.start();
  } catch (error) {
    await tradingBot.stop().catch(() => undefined);
    await db
      .update(bots)
      .set({
        status: fallbackStatus,
        errorMessage: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      })
      .where(eq(bots.id, botId));
    throw error;
  }

  runtimes.set(botId, { bot: tradingBot, runner });

  await db
    .update(bots)
    .set({ status: "running", startedAt: new Date(), errorMessage: null, updatedAt: new Date() })
    .where(eq(bots.id, botId));
  await redis.publish(
    "bot:status",
    JSON.stringify({ botId, status: "running", timestamp: Date.now() })
  );
  await logBot(db, botId, "info", "Bot execution started");

  return { status: "running" };
}

async function pauseBot(
  botId: string,
  db: Database,
  redis: IORedis,
  runtimes: Map<string, BotRuntime>
) {
  const runtime = runtimes.get(botId);
  if (!runtime) {
    return { status: "not-running" };
  }

  await runtime.bot.pause();
  await db.update(bots).set({ status: "paused", updatedAt: new Date() }).where(eq(bots.id, botId));
  await redis.publish(
    "bot:status",
    JSON.stringify({ botId, status: "paused", timestamp: Date.now() })
  );
  await logBot(db, botId, "info", "Bot execution paused");
  return { status: "paused" };
}

async function stopBot(
  botId: string,
  db: Database,
  redis: IORedis,
  runtimes: Map<string, BotRuntime>
) {
  const runtime = runtimes.get(botId);
  let stopError: unknown;

  try {
    if (runtime) {
      await runtime.runner.stop();
      await runtime.bot.stop();
    }
  } catch (error) {
    stopError = error;
    await logBot(
      db,
      botId,
      "error",
      error instanceof Error ? error.message : "Failed to stop bot runtime"
    );
  } finally {
    runtimes.delete(botId);

    await db
      .update(bots)
      .set({
        status: "stopped",
        stoppedAt: new Date(),
        errorMessage: stopError instanceof Error ? stopError.message : null,
        updatedAt: new Date(),
      })
      .where(eq(bots.id, botId));
  }

  await redis.publish(
    "bot:status",
    JSON.stringify({ botId, status: "stopped", timestamp: Date.now() })
  );
  await logBot(db, botId, "info", "Bot execution stopped");

  if (stopError) {
    throw stopError;
  }

  return { status: "stopped" };
}

async function createRuntimeExchange(
  botRow: typeof bots.$inferSelect,
  db: Database,
  exchangeManager: ExchangeManager
) {
  const publicExchange = new LiveExchange(await exchangeManager.getPublicExchange(botRow.exchange));

  if (botRow.mode === "paper") {
    return new PaperExchange(publicExchange, toNumber(botRow.currentBalance, 10_000));
  }

  if (botRow.mode === "live") {
    const config = (
      await db
        .select()
        .from(exchangeConfigs)
        .where(eq(exchangeConfigs.exchange, botRow.exchange))
        .limit(1)
    )[0];
    if (!config) {
      throw new Error(`Exchange config missing for ${botRow.exchange}`);
    }
    return new LiveExchange(await exchangeManager.getConfiguredExchange(config));
  }

  return new PaperExchange(publicExchange, toNumber(botRow.currentBalance, 10_000));
}

async function logBot(db: Database, botId: string, level: string, message: string) {
  await db.insert(botLogs).values({ botId, level, message });
}

async function withBotLock<T>(redis: IORedis, botId: string, fn: () => Promise<T>) {
  const token = randomUUID();
  const lockKey = `bot-runtime-lock:${botId}`;
  const acquired = await redis.set(lockKey, token, "PX", 30_000, "NX");

  if (acquired !== "OK") {
    throw new Error(`Bot ${botId} is already being processed`);
  }

  try {
    return await fn();
  } finally {
    await redis
      .eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
        1,
        lockKey,
        token
      )
      .catch(() => undefined);
  }
}
