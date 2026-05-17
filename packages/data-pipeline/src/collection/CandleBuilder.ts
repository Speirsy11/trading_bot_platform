import {
  buildCandlesFromTrades,
  deriveCandlesFromLowerTimeframe,
  updateIngestionHealth,
  upsertOHLCV,
  type Database,
} from "@tb/db";

const DERIVED_TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];

export class CandleBuilder {
  constructor(private readonly db: Database) {}

  async buildFromTrades(params: {
    exchange: string;
    symbol: string;
    startTime: Date;
    endTime: Date;
  }) {
    const oneMinuteCandles = await buildCandlesFromTrades(this.db, {
      ...params,
      timeframe: "1m",
    });
    const insertedOneMinute = await upsertOHLCV(this.db, oneMinuteCandles);

    if (oneMinuteCandles.length > 0) {
      const latest = oneMinuteCandles[oneMinuteCandles.length - 1]?.time ?? null;
      await updateIngestionHealth(this.db, {
        exchange: params.exchange,
        symbol: params.symbol,
        timeframe: "1m",
        latestCandleAt: latest,
        candlesInsertedDelta: insertedOneMinute.length,
      });
    }

    const derived: Record<string, number> = {};
    for (const targetTimeframe of DERIVED_TIMEFRAMES) {
      const candles = await deriveCandlesFromLowerTimeframe(this.db, {
        exchange: params.exchange,
        symbol: params.symbol,
        sourceTimeframe: "1m",
        targetTimeframe,
        startTime: params.startTime,
        endTime: params.endTime,
      });
      const inserted = await upsertOHLCV(this.db, candles);
      derived[targetTimeframe] = inserted.length;
      if (candles.length > 0) {
        await updateIngestionHealth(this.db, {
          exchange: params.exchange,
          symbol: params.symbol,
          timeframe: targetTimeframe,
          latestCandleAt: candles[candles.length - 1]?.time ?? null,
          candlesInsertedDelta: inserted.length,
        });
      }
    }

    return { oneMinute: insertedOneMinute.length, derived };
  }
}
