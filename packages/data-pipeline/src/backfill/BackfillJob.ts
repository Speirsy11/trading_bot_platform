import { createLogger } from "@tb/config";
import type { Database } from "@tb/db";
import { upsertOHLCV, dataCollectionStatus, type OHLCVInsert } from "@tb/db";
import { sql } from "drizzle-orm";

import { OHLCVCollector } from "../collection/OHLCVCollector.js";
import type { ExchangeRateLimiter } from "../rateLimit/ExchangeRateLimiter.js";
import { CandleValidator } from "../validation/CandleValidator.js";

const logger = createLogger("backfill-job");

export interface BackfillJobConfig {
  exchange: string;
  symbol: string;
  timeframe: string;
  startTime: Date;
  endTime: Date;
  batchSizeMs: number;
  maxCandlesPerRequest: number;
}

export class BackfillJob {
  private db: Database;
  private collector: OHLCVCollector;
  private validator: CandleValidator;

  constructor(db: Database, rateLimiter: ExchangeRateLimiter) {
    this.db = db;
    this.collector = new OHLCVCollector(rateLimiter);
    this.validator = new CandleValidator();
  }

  async run(config: BackfillJobConfig): Promise<{ totalInserted: number; totalInvalid: number }> {
    const { exchange, symbol, timeframe, startTime, endTime, maxCandlesPerRequest } = config;

    logger.info(
      { exchange, symbol, timeframe, start: startTime.toISOString(), end: endTime.toISOString() },
      "Starting backfill job",
    );

    await this.updateStatus(exchange, symbol, timeframe, "backfilling");

    let totalInserted = 0;
    let totalInvalid = 0;
    let currentSince = startTime.getTime();
    const endMs = endTime.getTime();

    try {
      while (currentSince < endMs) {
        const candles = await this.collector.fetchOHLCV(
          exchange,
          symbol,
          timeframe,
          currentSince,
          maxCandlesPerRequest,
        );

        if (candles.length === 0) break;

        const { valid, invalid } = this.validator.validateBatch(candles);
        totalInvalid += invalid.length;

        if (valid.length > 0) {
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

          await upsertOHLCV(this.db, rows);
          totalInserted += valid.length;
        }

        // Advance past the last candle we received
        const lastCandleTime = candles[candles.length - 1]!.time;
        if (lastCandleTime <= currentSince) break; // No progress
        currentSince = lastCandleTime + 1;

        logger.debug(
          { exchange, symbol, timeframe, progress: ((currentSince - startTime.getTime()) / (endMs - startTime.getTime()) * 100).toFixed(1) },
          "Backfill progress",
        );
      }

      await this.updateStatus(exchange, symbol, timeframe, "idle");
      logger.info(
        { exchange, symbol, timeframe, totalInserted, totalInvalid },
        "Backfill job completed",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.updateStatus(exchange, symbol, timeframe, "error", message);
      throw error;
    }

    return { totalInserted, totalInvalid };
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
          updatedAt: sql`NOW()`,
        },
      });
  }

  async close() {
    await this.collector.close();
  }
}
