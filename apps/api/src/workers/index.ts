import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createDb } from "@tb/db";
import IORedis from "ioredis";

import { createExchangeManager } from "../services/exchangeManager.js";
import { assertEncryptionSecret, KeyVault } from "../services/keyVault.js";

import { createBacktestWorker } from "./backtestRunner.js";
import { createBotExecutorWorker } from "./botExecutor.js";
import { createDataPipelineWorkers } from "./dataPipelineWorkers.js";

const processLogger = console;

async function startWorkers() {
  const databaseUrl = process.env["DATABASE_URL"]?.trim();
  const redisUrl = process.env["REDIS_URL"] ?? "redis://127.0.0.1:6379";
  const exportsDir = resolve(process.cwd(), "exports");

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before starting workers");
  }

  const encryptionKey = assertEncryptionSecret(process.env["ENCRYPTION_KEY"]);

  await mkdir(exportsDir, { recursive: true });

  const { db, client } = createDb(databaseUrl);
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const keyVault = new KeyVault(encryptionKey);
  const exchangeManager = createExchangeManager({ db, keyVault });

  const botWorker = createBotExecutorWorker({ db, redis, exchangeManager });
  const backtestWorker = createBacktestWorker({ db, redis });
  const pipelineWorkers = createDataPipelineWorkers({ db, redis, exportsDir });

  const shutdown = async (signal: string) => {
    console.warn(`workers shutting down: ${signal}`);
    await Promise.allSettled([
      botWorker.close(),
      backtestWorker.close(),
      pipelineWorkers.collectionWorker.close(),
      pipelineWorkers.backfillWorker.close(),
      pipelineWorkers.exportWorker.close(),
      redis.quit(),
      client.end(),
    ]);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

startWorkers().catch((error) => {
  processLogger.error("Failed to start workers", error);
  process.exit(1);
});
