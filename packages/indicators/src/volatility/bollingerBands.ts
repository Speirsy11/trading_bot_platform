import { sma } from "../trend/sma";
import type { BollingerBandsResult } from "../types";

/**
 * Bollinger Bands
 * Middle = SMA(period)
 * Upper = Middle + stdDevMultiplier * stdDev
 * Lower = Middle - stdDevMultiplier * stdDev
 */
export function bollingerBands(
  values: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerBandsResult {
  if (period < 1) throw new Error("Bollinger Bands period must be >= 1");
  if (values.length < period) return { upper: [], middle: [], lower: [] };

  const middle = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < middle.length; i++) {
    const start = i; // middle[0] corresponds to values[0..period-1]
    let sumSq = 0;
    for (let j = start; j < start + period; j++) {
      const diff = values[j]! - middle[i]!;
      sumSq += diff * diff;
    }
    const stdDev = Math.sqrt(sumSq / period);
    upper.push(middle[i]! + stdDevMultiplier * stdDev);
    lower.push(middle[i]! - stdDevMultiplier * stdDev);
  }

  return { upper, middle, lower };
}
