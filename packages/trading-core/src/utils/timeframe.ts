const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "2h": 2 * 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "8h": 8 * 60 * 60_000,
  "12h": 12 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

export function timeframeToMs(timeframe: string): number {
  const ms = TIMEFRAME_MS[timeframe];
  if (!ms) throw new Error(`Unknown timeframe: ${timeframe}`);
  return ms;
}

export function msToTimeframe(ms: number): string | undefined {
  for (const [tf, val] of Object.entries(TIMEFRAME_MS)) {
    if (val === ms) return tf;
  }
  return undefined;
}

export function candlesInRange(startMs: number, endMs: number, timeframe: string): number {
  const ms = timeframeToMs(timeframe);
  return Math.floor((endMs - startMs) / ms);
}
