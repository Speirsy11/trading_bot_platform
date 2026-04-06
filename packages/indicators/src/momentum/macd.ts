import { ema } from "../trend/ema";
import type { MACDResult } from "../types";

/**
 * Moving Average Convergence Divergence (MACD)
 * MACD line = fastEMA - slowEMA
 * Signal line = EMA of MACD line
 * Histogram = MACD - Signal
 */
export function macd(
  values: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  if (!Number.isInteger(fastPeriod) || fastPeriod < 1)
    throw new Error("MACD fast period must be a positive integer");
  if (!Number.isInteger(slowPeriod) || slowPeriod < 1)
    throw new Error("MACD slow period must be a positive integer");
  if (!Number.isInteger(signalPeriod) || signalPeriod < 1)
    throw new Error("MACD signal period must be a positive integer");
  if (fastPeriod >= slowPeriod) throw new Error("Fast period must be less than slow period");
  if (values.length < slowPeriod + signalPeriod - 1) return { macd: [], signal: [], histogram: [] };

  const fastEMA = ema(values, fastPeriod);
  const slowEMA = ema(values, slowPeriod);

  // Align: fast EMA starts at index (fastPeriod-1), slow at (slowPeriod-1)
  // MACD line starts where both exist
  const offset = slowPeriod - fastPeriod;
  const macdLine: number[] = [];

  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset]! - slowEMA[i]!);
  }

  const signalLine = ema(macdLine, signalPeriod);
  const histogramOffset = macdLine.length - signalLine.length;

  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + histogramOffset]! - signalLine[i]!);
  }

  // Return aligned arrays (all same length as signal)
  return {
    macd: macdLine.slice(histogramOffset),
    signal: signalLine,
    histogram,
  };
}
