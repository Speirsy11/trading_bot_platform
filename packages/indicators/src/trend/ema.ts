/**
 * Exponential Moving Average (EMA)
 * Uses a multiplier of 2/(period+1) and seeds with SMA of first `period` values.
 */
export function ema(values: number[], period: number): number[] {
  if (period < 1) throw new Error("EMA period must be >= 1");
  if (values.length < period) return [];

  const multiplier = 2 / (period + 1);
  const result: number[] = [];

  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i]!;
  }
  let prev = sum / period;
  result.push(prev);

  for (let i = period; i < values.length; i++) {
    prev = (values[i]! - prev) * multiplier + prev;
    result.push(prev);
  }

  return result;
}
