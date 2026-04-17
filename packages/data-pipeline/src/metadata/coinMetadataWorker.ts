import { createLogger } from "@tb/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";

import { CoinGeckoClient, SYMBOL_TO_COINGECKO_ID } from "./CoinGeckoClient";

const logger = createLogger("coin-metadata-worker");

export const COIN_METADATA_QUEUE = "coin-metadata";
export const COIN_METADATA_REPEAT_PATTERN = "0 */6 * * *";
export const COIN_METADATA_CHANNEL = "coin:metadata";

export interface CoinMetadataWorkerConfig {
  redisConnection: { host: string; port: number };
}

export function createCoinMetadataWorker(config: CoinMetadataWorkerConfig) {
  const client = new CoinGeckoClient();
  const publisher = new IORedis(config.redisConnection);

  const coinIds = Object.values(SYMBOL_TO_COINGECKO_ID);

  const worker = new Worker(
    COIN_METADATA_QUEUE,
    async () => {
      logger.info("Fetching coin metadata from CoinGecko");

      const data = await client.fetchMarketData(coinIds);

      await publisher.publish(COIN_METADATA_CHANNEL, JSON.stringify(data));

      logger.info({ count: data.length }, "Coin metadata published to Redis channel");

      return { count: data.length };
    },
    {
      connection: config.redisConnection,
      concurrency: 1,
    }
  );

  return worker;
}
