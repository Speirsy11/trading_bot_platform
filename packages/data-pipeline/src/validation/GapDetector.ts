import type { Database } from "@tb/db";
import { ohlcv, dataCollectionStatus } from "@tb/db";
import { and, eq, gte, lte } from "drizzle-orm";

interface Gap {
  exchange: string;
  symbol: string;
  timeframe: string;
  start: Date;
  end: Date;
  missingCount: number;
}

const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

export class GapDetector {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  getTimeframeMs(timeframe: string): number {
    return TIMEFRAME_MS[timeframe] ?? 60_000;
  }

  async detectGaps(
    exchange: string,
    symbol: string,
    timeframe: string,
    startTime: Date,
    endTime: Date,
  ): Promise<Gap[]> {
    const intervalMs = this.getTimeframeMs(timeframe);
    const gaps: Gap[] = [];

    // Fetch all timestamps we have in the range
    const rows = await this.db
      .select({ time: ohlcv.time })
      .from(ohlcv)
      .where(
        and(
          eq(ohlcv.exchange, exchange),
          eq(ohlcv.symbol, symbol),
          eq(ohlcv.timeframe, timeframe),
          gte(ohlcv.time, startTime),
          lte(ohlcv.time, endTime),
        ),
      )
      .orderBy(ohlcv.time);

    const existingTimestamps = new Set(rows.map((r) => r.time!.getTime()));

    // Generate expected timestamps
    let currentGapStart: Date | null = null;
    let gapMissing = 0;

    for (
      let ts = startTime.getTime();
      ts <= endTime.getTime();
      ts += intervalMs
    ) {
      if (!existingTimestamps.has(ts)) {
        if (!currentGapStart) {
          currentGapStart = new Date(ts);
          gapMissing = 0;
        }
        gapMissing++;
      } else {
        if (currentGapStart && gapMissing > 0) {
          gaps.push({
            exchange,
            symbol,
            timeframe,
            start: currentGapStart,
            end: new Date(ts - intervalMs),
            missingCount: gapMissing,
          });
          currentGapStart = null;
          gapMissing = 0;
        }
      }
    }

    // Close any trailing gap
    if (currentGapStart && gapMissing > 0) {
      gaps.push({
        exchange,
        symbol,
        timeframe,
        start: currentGapStart,
        end: endTime,
        missingCount: gapMissing,
      });
    }

    return gaps;
  }

  async updateGapCount(
    exchange: string,
    symbol: string,
    timeframe: string,
    gapCount: number,
  ) {
    await this.db
      .update(dataCollectionStatus)
      .set({ gapCount, updatedAt: new Date() })
      .where(
        and(
          eq(dataCollectionStatus.exchange, exchange),
          eq(dataCollectionStatus.symbol, symbol),
          eq(dataCollectionStatus.timeframe, timeframe),
        ),
      );
  }
}

export type { Gap };
