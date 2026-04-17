import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createDb } from "@tb/db";
import IORedis from "ioredis";

import { createApp } from "./app";
import { createQueueSet } from "./queues/index";
import { createExchangeManager } from "./services/exchangeManager";
import { assertEncryptionSecret, KeyVault } from "./services/keyVault";
import { bootstrapStrategies } from "./services/strategyCatalog";
import { validateAndPrintEnv } from "./utils/envValidation";
import { createFastifyLoggerOptions } from "./utils/logger";
import { reconcileOpenOrders } from "./workers/reconcileOrders";

async function start() {
  const databaseUrl = process.env["DATABASE_URL"]?.trim();
  const redisUrl = process.env["REDIS_URL"] ?? "redis://127.0.0.1:6379";
  const rawPort = process.env["API_PORT"] ?? "3001";
  const port = Number.parseInt(rawPort, 10);
  const host = process.env["API_HOST"] ?? "0.0.0.0";
  const exportsDir = resolve(process.cwd(), "exports");
  const loggerOptions = createFastifyLoggerOptions();
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  let client: ReturnType<typeof createDb>["client"] | undefined;
  let redis: IORedis | undefined;
  let subscriber: IORedis | undefined;
  let queues: ReturnType<typeof createQueueSet> | undefined;

  try {
    validateAndPrintEnv();

    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set to a non-empty value before startup");
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`API_PORT must be an integer between 1 and 65535; received ${rawPort}`);
    }

    console.info(`API startup configuration: redisUrl=${redisUrl}, host=${host}`);

    const encryptionKey = assertEncryptionSecret(process.env["ENCRYPTION_KEY"]);

    await mkdir(exportsDir, { recursive: true });

    const dbHandle = createDb(databaseUrl);
    client = dbHandle.client;
    const db = dbHandle.db;
    redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    subscriber = redis.duplicate();
    queues = createQueueSet(redis);
    const keyVault = new KeyVault(encryptionKey);
    const exchangeManager = createExchangeManager({ db, keyVault });

    bootstrapStrategies();

    app = await createApp({
      db,
      redis,
      subscriber,
      queues,
      exportsDir,
      keyVault,
      exchangeManager,
      loggerOptions,
      enableBullBoard: process.env["NODE_ENV"] !== "production",
      bullBoardAuth: resolveBullBoardAuth(),
    });

    const shutdown = async (signal: string) => {
      app?.log.info({ signal }, "shutting down api server");
      if (app) {
        await app.close();
      }
      await cleanup(subscriber, redis, queues, client);
      process.exit(0);
    };

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });

    await app.listen({ host, port });
    app.log.info({ host, port }, "api server listening");

    // Reconcile any stuck orders from before this startup, non-blocking
    reconcileOpenOrders(dbHandle.db, exchangeManager)
      .then((result) => {
        app?.log.info(result, "order reconciliation complete");
      })
      .catch((err: unknown) => {
        app?.log.warn({ err }, "order reconciliation failed (non-fatal)");
      });
  } catch (error) {
    if (app) {
      app.log.error(error, "failed to start api server");
    } else {
      console.error("failed to start api server", error);
    }
    await cleanup(subscriber, redis, queues, client);
    process.exit(1);
  }
}

void start();

async function cleanup(
  subscriber: IORedis | undefined,
  redis: IORedis | undefined,
  queues: ReturnType<typeof createQueueSet> | undefined,
  client: ReturnType<typeof createDb>["client"] | undefined
) {
  await Promise.allSettled([
    subscriber?.quit() ?? Promise.resolve(),
    redis?.quit() ?? Promise.resolve(),
    queues?.close() ?? Promise.resolve(),
    client?.end() ?? Promise.resolve(),
  ]);
}

function resolveBullBoardAuth() {
  const username = process.env["BULL_BOARD_USERNAME"]?.trim();
  const password = process.env["BULL_BOARD_PASSWORD"]?.trim();
  if (!username || !password) {
    return undefined;
  }

  return { username, password };
}
