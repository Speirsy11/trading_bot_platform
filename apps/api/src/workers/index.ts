import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createDb } from "@tb/db";
import IORedis from "ioredis";

import { createExchangeManager } from "../services/exchangeManager.js";
import { KeyVault } from "../services/keyVault.js";

import { createBacktestWorker } from "./backtestRunner.js";
import { createBotExecutorWorker } from "./botExecutor.js";
import { createDataPipelineWorkers } from "./dataPipelineWorkers.js";

async function startWorkers() {
  const databaseUrl = process.env["DATABASE_URL"];
  const redisUrl = process.env["REDIS_URL"] ?? "redis://127.0.0.1:6379";
  const exportsDir = resolve(process.cwd(), "exports");

  await mkdir(exportsDir, { recursive: true });

  const { db, client } = createDb(databaseUrl);
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const keyVault = new KeyVault(process.env["ENCRYPTION_KEY"]);
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

void startWorkers();
