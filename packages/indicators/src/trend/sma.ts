/**
 * Simple Moving Average (SMA)
 * Average of the last `period` values.
 */
export function sma(values: number[], period: number): number[] {
  if (!Number.isInteger(period) || period < 1)
    throw new Error("SMA period must be a positive integer");
  if (values.length < period) return [];

  const result: number[] = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += values[i]!;
  }
  result.push(sum / period);

  for (let i = period; i < values.length; i++) {
    sum += values[i]! - values[i - period]!;
    result.push(sum / period);
  }

  return result;
}
