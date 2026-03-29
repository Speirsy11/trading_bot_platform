import { sma } from "../trend/sma.js";
import type { StochasticResult } from "../types.js";

/**
 * Stochastic Oscillator
 * %K = (close - lowestLow) / (highestHigh - lowestLow) * 100
 * %D = SMA(%K, dPeriod)
 */
export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticResult {
  if (kPeriod < 1) throw new Error("Stochastic K period must be >= 1");
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < kPeriod) return { k: [], d: [] };

  const kValues: number[] = [];

  for (let i = kPeriod - 1; i < len; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j]! > highestHigh) highestHigh = highs[j]!;
      if (lows[j]! < lowestLow) lowestLow = lows[j]!;
    }

    const range = highestHigh - lowestLow;
    kValues.push(range === 0 ? 50 : ((closes[i]! - lowestLow) / range) * 100);
  }

  const dValues = sma(kValues, dPeriod);

  // Align %K to same length as %D
  const offset = kValues.length - dValues.length;
  return {
    k: kValues.slice(offset),
    d: dValues,
  };
}
