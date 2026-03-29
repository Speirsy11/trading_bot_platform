import type { Candle } from "@tb/types";

/**
 * Volume-Weighted Average Price (VWAP)
 * VWAP = cumulative(typicalPrice * volume) / cumulative(volume)
 * Typical Price = (high + low + close) / 3
 */
export function vwap(candles: Candle[]): number[] {
  if (candles.length === 0) return [];

  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    result.push(cumulativeVolume === 0 ? typicalPrice : cumulativeTPV / cumulativeVolume);
  }

  return result;
}
