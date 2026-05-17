import {
  countExpectedCandles,
  logIngestionEvent,
  updateIngestionHealth,
  type Database,
} from "@tb/db";

import { CandleBuilder } from "../collection/CandleBuilder";
import { GapDetector } from "../validation/GapDetector";

export class RepairManager {
  private readonly gapDetector: GapDetector;
  private readonly candleBuilder: CandleBuilder;

  constructor(private readonly db: Database) {
    this.gapDetector = new GapDetector(db);
    this.candleBuilder = new CandleBuilder(db);
  }

  async repairRecent(params: {
    exchange: string;
    symbol: string;
    timeframe: string;
    lookbackMs?: number;
  }) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (params.lookbackMs ?? 60 * 60_000));

    if (params.timeframe === "1m") {
      await this.candleBuilder.buildFromTrades({
        exchange: params.exchange,
        symbol: params.symbol,
        startTime,
        endTime,
      });
    }

    const gaps = await this.gapDetector.detectGaps(
      params.exchange,
      params.symbol,
      params.timeframe,
      startTime,
      endTime
    );
    const missing = gaps.reduce((sum, gap) => sum + gap.missingCount, 0);
    await this.gapDetector.updateGapCount(
      params.exchange,
      params.symbol,
      params.timeframe,
      missing
    );

    const { expected, actual } = await countExpectedCandles(this.db, {
      exchange: params.exchange,
      symbol: params.symbol,
      timeframe: params.timeframe,
      startTime,
      endTime,
    });
    const completenessBps = expected === 0 ? 10000 : Math.floor((actual / expected) * 10000);

    await updateIngestionHealth(this.db, {
      exchange: params.exchange,
      symbol: params.symbol,
      timeframe: params.timeframe,
      missingCandles: missing,
      completenessBps,
      backfillBacklog: missing,
    });

    if (missing > 0) {
      await logIngestionEvent(this.db, {
        exchange: params.exchange,
        symbol: params.symbol,
        timeframe: params.timeframe,
        eventType: "gap_detected",
        severity: "warn",
        message: `Detected ${missing} missing ${params.timeframe} candles`,
        metadata: { gaps },
      });
    }

    return { missing, gaps, completenessBps };
  }
}
