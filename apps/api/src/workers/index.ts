import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createDb } from "@tb/db";
import IORedis from "ioredis";

import { createExchangeManager } from "../services/exchangeManager";
import { createCanonicalMarketDataReader } from "../services/harvesterMarketData";
import { assertEncryptionSecret, KeyVault } from "../services/keyVault";
import { assertDatabaseSchemaReady } from "../utils/databaseSchema";

import { createBacktestWorker } from "./backtestRunner";
import { createBotExecutorWorker } from "./botExecutor";
import { createDataPipelineWorkers } from "./dataPipelineWorkers";
import { createDataRetentionWorker, scheduleDataRetentionJob } from "./dataRetentionWorker";
import { startHealthServer } from "./healthServer";
import { createResearchWorker } from "./researchRunner";

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
  await assertDatabaseSchemaReady(client);
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const keyVault = new KeyVault(encryptionKey);
  const exchangeManager = createExchangeManager({ db, keyVault });
  const marketData = createCanonicalMarketDataReader({
    db,
    harvesterDatabaseUrl: process.env["SIGNAL_HARVESTER_DATABASE_URL"],
  });

  // Schedule the daily data-retention job (purges old bot_logs and ohlcv rows)
  await scheduleDataRetentionJob(redis);

  const botWorker = createBotExecutorWorker({ db, redis, exchangeManager, marketData });
  const backtestWorker = createBacktestWorker({ db, redis, marketData });
  const researchWorker = createResearchWorker({ db, redis, marketData });
  const pipelineWorkers = await createDataPipelineWorkers({
    db,
    redis,
    exportsDir,
    marketData,
  });
  const retentionWorker = createDataRetentionWorker({ db, redis });

  startHealthServer();

  const shutdown = async (signal: string) => {
    console.warn(`workers shutting down: ${signal}`);
    await Promise.allSettled([
      botWorker.close(),
      backtestWorker.close(),
      researchWorker.close(),
      pipelineWorkers.exportWorker.close(),
      retentionWorker.close(),
      marketData.close?.(),
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
