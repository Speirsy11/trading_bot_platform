import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createDb } from "@tb/db";
import IORedis from "ioredis";

import { createApp } from "./app.js";
import { createQueueSet } from "./queues/index.js";
import { createExchangeManager } from "./services/exchangeManager.js";
import { KeyVault } from "./services/keyVault.js";
import { bootstrapStrategies } from "./services/strategyCatalog.js";
import { createFastifyLoggerOptions } from "./utils/logger.js";

async function start() {
  const databaseUrl = process.env["DATABASE_URL"];
  const redisUrl = process.env["REDIS_URL"] ?? "redis://127.0.0.1:6379";
  const port = Number(process.env["API_PORT"] ?? 3001);
  const host = process.env["API_HOST"] ?? "0.0.0.0";
  const exportsDir = resolve(process.cwd(), "exports");

  await mkdir(exportsDir, { recursive: true });

  const loggerOptions = createFastifyLoggerOptions();
  const { db, client } = createDb(databaseUrl);
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const subscriber = redis.duplicate();
  const queues = createQueueSet(redis);
  const keyVault = new KeyVault(process.env["ENCRYPTION_KEY"]);
  const exchangeManager = createExchangeManager({ db, keyVault });

  bootstrapStrategies();

  const app = await createApp({
    db,
    redis,
    subscriber,
    queues,
    exportsDir,
    keyVault,
    exchangeManager,
    loggerOptions,
    enableBullBoard: process.env["NODE_ENV"] !== "production",
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down api server");
    await app.close();
    await Promise.allSettled([subscriber.quit(), redis.quit(), queues.close(), client.end()]);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  try {
    await app.listen({ host, port });
    app.log.info({ host, port }, "api server listening");
  } catch (error) {
    app.log.error(error, "failed to start api server");
    await Promise.allSettled([subscriber.quit(), redis.quit(), queues.close(), client.end()]);
    process.exit(1);
  }
}

void start();
