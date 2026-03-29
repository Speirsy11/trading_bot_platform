import { createLogger } from "@tb/config";
import type { Database } from "@tb/db";
import { getLatestTimestamp, upsertOHLCV, dataCollectionStatus, type OHLCVInsert } from "@tb/db";
import { sql } from "drizzle-orm";

import type { ExchangeRateLimiter } from "../rateLimit/ExchangeRateLimiter.js";

import { OHLCVCollector } from "./OHLCVCollector.js";


const logger = createLogger("data-collector");

export class DataCollector {
  private db: Database;
  private collector: OHLCVCollector;

  constructor(db: Database, rateLimiter: ExchangeRateLimiter) {
    this.db = db;
    this.collector = new OHLCVCollector(rateLimiter);
  }

  async collectOHLCV(
    exchange: string,
    symbol: string,
    timeframe: string,
  ) {
    try {
      // Update status to collecting
      await this.updateStatus(exchange, symbol, timeframe, "collecting");

      // Get latest timestamp we have
      const latest = await getLatestTimestamp(this.db, exchange, symbol, timeframe);

      // Fetch incrementally
      const { valid, invalid } = await this.collector.fetchIncremental(
        exchange,
        symbol,
        timeframe,
        latest,
      );

      if (invalid.length > 0) {
        logger.warn(
          { exchange, symbol, timeframe, count: invalid.length },
          "Invalid candles rejected",
        );
      }

      if (valid.length === 0) {
        await this.updateStatus(exchange, symbol, timeframe, "idle");
        return { inserted: 0, invalid: invalid.length };
      }

      // Convert to insert format
      const rows: OHLCVInsert[] = valid.map((c) => ({
        time: new Date(c.time),
        exchange,
        symbol,
        timeframe,
        open: c.open.toString(),
        high: c.high.toString(),
        low: c.low.toString(),
        close: c.close.toString(),
        volume: c.volume.toString(),
        tradesCount: c.tradesCount ?? null,
      }));

      // UPSERT
      await upsertOHLCV(this.db, rows);

      // Update status
      await this.updateStatus(exchange, symbol, timeframe, "idle");

      logger.info(
        { exchange, symbol, timeframe, inserted: valid.length },
        "OHLCV data collected",
      );

      return { inserted: valid.length, invalid: invalid.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.updateStatus(exchange, symbol, timeframe, "error", message);
      logger.error({ exchange, symbol, timeframe, error: message }, "Collection failed");
      throw error;
    }
  }

  private async updateStatus(
    exchange: string,
    symbol: string,
    timeframe: string,
    status: string,
    errorMessage?: string,
  ) {
    await this.db
      .insert(dataCollectionStatus)
      .values({
        exchange,
        symbol,
        timeframe,
        status,
        errorMessage: errorMessage ?? null,
        lastCollectedAt: status === "idle" ? new Date() : undefined,
      })
      .onConflictDoUpdate({
        target: [
          dataCollectionStatus.exchange,
          dataCollectionStatus.symbol,
          dataCollectionStatus.timeframe,
        ],
        set: {
          status,
          errorMessage: errorMessage ?? null,
          lastCollectedAt:
            status === "idle" ? sql`NOW()` : sql`${dataCollectionStatus.lastCollectedAt}`,
          updatedAt: sql`NOW()`,
        },
      });
  }

  async close() {
    await this.collector.close();
  }
}
