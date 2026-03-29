/**
 * Round a number to a fixed number of decimal places.
 * Avoids floating-point rounding errors for financial calculations.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const d = Math.max(0, Math.round(decimals));
  const factor = Math.pow(10, d);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate percentage change between two values.
 */
export function percentChange(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}
