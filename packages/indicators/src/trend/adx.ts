import type { Candle } from "@tb/types";

/**
 * Average Directional Index (ADX)
 * Measures trend strength using +DI, -DI, and smoothed DX.
 */
export function adx(
  candles: Candle[],
  period: number = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  if (period < 1) throw new Error("ADX period must be >= 1");
  if (candles.length < period * 2) return { adx: [], plusDI: [], minusDI: [] };

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);

  // Calculate True Range, +DM, -DM
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const highDiff = highs[i]! - highs[i - 1]!;
    const lowDiff = lows[i - 1]! - lows[i]!;

    tr.push(
      Math.max(
        highs[i]! - lows[i]!,
        Math.abs(highs[i]! - closes[i - 1]!),
        Math.abs(lows[i]! - closes[i - 1]!)
      )
    );

    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
  }

  // Wilder's smoothing for first period values
  const smoothTR: number[] = [];
  const smoothPlusDM: number[] = [];
  const smoothMinusDM: number[] = [];

  let trSum = 0;
  let plusSum = 0;
  let minusSum = 0;

  for (let i = 0; i < period; i++) {
    trSum += tr[i]!;
    plusSum += plusDM[i]!;
    minusSum += minusDM[i]!;
  }

  smoothTR.push(trSum);
  smoothPlusDM.push(plusSum);
  smoothMinusDM.push(minusSum);

  for (let i = period; i < tr.length; i++) {
    const prevTR = smoothTR[smoothTR.length - 1]!;
    const prevPlus = smoothPlusDM[smoothPlusDM.length - 1]!;
    const prevMinus = smoothMinusDM[smoothMinusDM.length - 1]!;

    smoothTR.push(prevTR - prevTR / period + tr[i]!);
    smoothPlusDM.push(prevPlus - prevPlus / period + plusDM[i]!);
    smoothMinusDM.push(prevMinus - prevMinus / period + minusDM[i]!);
  }

  // Calculate +DI, -DI, DX
  const plusDIArr: number[] = [];
  const minusDIArr: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < smoothTR.length; i++) {
    const trVal = smoothTR[i]!;
    const pdi = trVal === 0 ? 0 : (smoothPlusDM[i]! / trVal) * 100;
    const mdi = trVal === 0 ? 0 : (smoothMinusDM[i]! / trVal) * 100;
    plusDIArr.push(pdi);
    minusDIArr.push(mdi);

    const diSum = pdi + mdi;
    dx.push(diSum === 0 ? 0 : (Math.abs(pdi - mdi) / diSum) * 100);
  }

  // Smooth DX to get ADX (Wilder's smoothing)
  if (dx.length < period) return { adx: [], plusDI: [], minusDI: [] };

  const adxResult: number[] = [];
  let adxSum = 0;
  for (let i = 0; i < period; i++) {
    adxSum += dx[i]!;
  }
  let prevADX = adxSum / period;
  adxResult.push(prevADX);

  for (let i = period; i < dx.length; i++) {
    prevADX = (prevADX * (period - 1) + dx[i]!) / period;
    adxResult.push(prevADX);
  }

  // Align output arrays — ADX starts at index (2*period - 1) from original
  const offset = dx.length - adxResult.length;
  const alignedPlusDI = plusDIArr.slice(offset);
  const alignedMinusDI = minusDIArr.slice(offset);

  return { adx: adxResult, plusDI: alignedPlusDI, minusDI: alignedMinusDI };
}
