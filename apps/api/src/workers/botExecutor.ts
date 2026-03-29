import { botLogs, bots, exchangeConfigs, type Database } from "@tb/db";
import {
  Bot as TradingBot,
  BotRunner,
  LiveExchange,
  PaperExchange,
  StrategyRegistry,
} from "@tb/trading-core";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import type IORedis from "ioredis";

import { API_QUEUE_NAMES, BOT_JOB_NAMES, type BotJobData } from "../queues/types.js";
import type { ExchangeManager } from "../services/exchangeManager.js";
import { bootstrapStrategies } from "../services/strategyCatalog.js";
import { parseJsonValue, toNumber } from "../utils/serialization.js";

interface BotRuntime {
  bot: TradingBot;
  runner: BotRunner;
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
          return startBot(
            job.data.botId,
            options.db,
            options.redis,
            options.exchangeManager,
            runtimes
          );
        case BOT_JOB_NAMES.PAUSE:
          return pauseBot(job.data.botId, options.db, options.redis, runtimes);
        case BOT_JOB_NAMES.STOP:
          return stopBot(job.data.botId, options.db, options.redis, runtimes);
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

  const strategy = StrategyRegistry.create(botRow.strategy);
  const runtimeExchange = await createRuntimeExchange(botRow, db, exchangeManager);
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
  const runner = new BotRunner(tradingBot, runtimeExchange, botRow.symbol, botRow.timeframe);
  await runner.start();
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
  if (runtime) {
    await runtime.runner.stop();
    await runtime.bot.stop();
    runtimes.delete(botId);
  }

  await db
    .update(bots)
    .set({ status: "stopped", stoppedAt: new Date(), updatedAt: new Date() })
    .where(eq(bots.id, botId));
  await redis.publish(
    "bot:status",
    JSON.stringify({ botId, status: "stopped", timestamp: Date.now() })
  );
  await logBot(db, botId, "info", "Bot execution stopped");
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
