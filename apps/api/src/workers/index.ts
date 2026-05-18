import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createDb, settings } from "@tb/db";
import { eq } from "drizzle-orm";
import IORedis from "ioredis";

import { createExchangeManager } from "../services/exchangeManager";
import { assertEncryptionSecret, KeyVault } from "../services/keyVault";
import { assertDatabaseSchemaReady } from "../utils/databaseSchema";

import { createBacktestWorker } from "./backtestRunner";
import { createBotExecutorWorker } from "./botExecutor";
import { createDataPipelineWorkers } from "./dataPipelineWorkers";
import { createDataRetentionWorker, scheduleDataRetentionJob } from "./dataRetentionWorker";
import { startHarvesterMarketDataSync } from "./harvesterMarketDataSync";
import { startHealthServer } from "./healthServer";

const processLogger = console;

async function loadCollectionConfig(db: ReturnType<typeof createDb>["db"]) {
  const rows = await db.select().from(settings).where(eq(settings.key, "collection.pairs"));
  const pairsRow = rows[0];

  const tfRows = await db.select().from(settings).where(eq(settings.key, "collection.timeframes"));
  const tfRow = tfRows[0];

  const exRows = await db.select().from(settings).where(eq(settings.key, "collection.exchanges"));
  const exRow = exRows[0];

  return {
    pairs: pairsRow ? (JSON.parse(pairsRow.value) as string[]) : [],
    timeframes: tfRow ? (JSON.parse(tfRow.value) as string[]) : [],
    exchanges: exRow ? (JSON.parse(exRow.value) as string[]) : [],
  };
}

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

  // Schedule the daily data-retention job (purges old bot_logs and ohlcv rows)
  await scheduleDataRetentionJob(redis);

  const botWorker = createBotExecutorWorker({ db, redis, exchangeManager });
  const backtestWorker = createBacktestWorker({ db, redis });
  const collectionConfig = await loadCollectionConfig(db);
  const pipelineWorkers = await createDataPipelineWorkers({
    db,
    redis,
    exportsDir,
    collectionConfig,
  });
  const harvesterMarketDataSync =
    process.env["SIGNAL_HARVESTER_URL"] && process.env["APP_MODE"] !== "testing"
      ? startHarvesterMarketDataSync({
          db,
          redis,
          harvesterUrl: process.env["SIGNAL_HARVESTER_URL"],
          config: collectionConfig,
          intervalMs: Number(process.env["HARVESTER_SYNC_INTERVAL_MS"] ?? "60000"),
        })
      : null;
  const retentionWorker = createDataRetentionWorker({ db, redis });

  startHealthServer();

  const shutdown = async (signal: string) => {
    console.warn(`workers shutting down: ${signal}`);
    await Promise.allSettled([
      botWorker.close(),
      backtestWorker.close(),
      pipelineWorkers.collectionWorker.close(),
      pipelineWorkers.backfillWorker.close(),
      pipelineWorkers.exportWorker.close(),
      pipelineWorkers.collectionQueue.close(),
      pipelineWorkers.backfillQueue.close(),
      harvesterMarketDataSync?.close(),
      retentionWorker.close(),
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
