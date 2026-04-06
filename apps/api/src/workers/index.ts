import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createQueues, setupRepeatableJobs, addDetectGapsJob } from "@tb/data-pipeline";
import { createDb, settings } from "@tb/db";
import { eq } from "drizzle-orm";
import IORedis from "ioredis";

import { createExchangeManager } from "../services/exchangeManager";
import { assertEncryptionSecret, KeyVault } from "../services/keyVault";

import { createBacktestWorker } from "./backtestRunner";
import { createBotExecutorWorker } from "./botExecutor";
import { createDataPipelineWorkers } from "./dataPipelineWorkers";

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

async function scheduleDataCollection(
  db: ReturnType<typeof createDb>["db"],
  redisConnection: { host: string; port: number }
) {
  const config = await loadCollectionConfig(db);

  if (config.pairs.length === 0 || config.exchanges.length === 0) {
    processLogger.warn(
      "No collection config found in settings table. Run `pnpm db:seed` first. Skipping job scheduling."
    );
    return;
  }

  processLogger.info(
    `Scheduling collection: ${config.exchanges.length} exchange(s), ${config.pairs.length} pair(s), ${config.timeframes.length} timeframe(s)`
  );

  const { collectionQueue } = createQueues({ redisConnection });

  await setupRepeatableJobs(collectionQueue, config.pairs, config.exchanges);

  // Also schedule gap detection for each pair/exchange/timeframe
  for (const exchange of config.exchanges) {
    for (const symbol of config.pairs) {
      for (const timeframe of config.timeframes) {
        await addDetectGapsJob(collectionQueue, exchange, symbol, timeframe);
      }
    }
  }

  await collectionQueue.close();
  processLogger.info("Repeatable data-collection jobs registered.");
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
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const keyVault = new KeyVault(encryptionKey);
  const exchangeManager = createExchangeManager({ db, keyVault });

  // Parse Redis connection for BullMQ
  const redisConnection = {
    host: redis.options.host ?? "127.0.0.1",
    port: redis.options.port ?? 6379,
  };

  // Schedule repeatable data collection jobs from DB config
  await scheduleDataCollection(db, redisConnection);

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
