/**
 * On-Balance Volume (OBV)
 * If close > prevClose: OBV += volume
 * If close < prevClose: OBV -= volume
 * If close == prevClose: OBV unchanged
 */
export function obv(closes: number[], volumes: number[]): number[] {
  const len = Math.min(closes.length, volumes.length);
  if (len === 0) return [];

  const result: number[] = [volumes[0]!];

  for (let i = 1; i < len; i++) {
    const prev = result[i - 1]!;
    if (closes[i]! > closes[i - 1]!) {
      result.push(prev + volumes[i]!);
    } else if (closes[i]! < closes[i - 1]!) {
      result.push(prev - volumes[i]!);
    } else {
      result.push(prev);
    }
  }

  return result;
}
