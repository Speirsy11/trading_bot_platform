/**
 * Relative Strength Index (RSI)
 * Uses Wilder's smoothing method (exponential moving average with alpha = 1/period).
 */
export function rsi(values: number[], period: number = 14): number[] {
  if (period < 1) throw new Error("RSI period must be >= 1");
  if (values.length < period + 1) return [];

  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    changes.push(values[i]! - values[i - 1]!);
  }

  // First average gain/loss (SMA of first `period` changes)
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    const change = changes[i]!;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  const result: number[] = [];
  result.push(
    avgGain === 0 && avgLoss === 0 ? 50 : avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  );

  // Wilder's smoothing for subsequent values
  for (let i = period; i < changes.length; i++) {
    const change = changes[i]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result.push(
      avgGain === 0 && avgLoss === 0
        ? 50
        : avgLoss === 0
          ? 100
          : 100 - 100 / (1 + avgGain / avgLoss)
    );
  }

  return result;
}
