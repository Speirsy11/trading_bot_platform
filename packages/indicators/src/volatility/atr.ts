import type { Candle } from "@tb/types";

/**
 * Average True Range (ATR)
 * True Range = max(high - low, |high - prevClose|, |low - prevClose|)
 * ATR = Wilder's smoothed average of True Range
 */
export function atr(candles: Candle[], period: number = 14): number[] {
  if (period < 1) throw new Error("ATR period must be >= 1");
  if (candles.length < period + 1) return [];

  // Calculate True Range
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i]!.high;
    const low = candles[i]!.low;
    const prevClose = candles[i - 1]!.close;

    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  // First ATR is SMA of first `period` TR values
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i]!;
  }
  let prev = sum / period;
  result.push(prev);

  // Subsequent ATR values use Wilder's smoothing
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]!) / period;
    result.push(prev);
  }

  return result;
}
