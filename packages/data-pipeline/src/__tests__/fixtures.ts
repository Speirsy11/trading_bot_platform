import type { Candle } from "@tb/types";

// Generate realistic BTC/USDT 1h candles starting from 2024-01-01
export function generateRealisticCandles(count: number, startPrice = 42000): Candle[] {
  const candles: Candle[] = [];
  const startTime = new Date("2024-01-01T00:00:00Z").getTime();
  const intervalMs = 60 * 60 * 1000; // 1 hour

  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const volatility = 0.005; // 0.5% per candle
    const drift = (Math.random() - 0.5) * 2 * volatility;

    const open = price;
    const change = open * drift;
    const close = open + change;
    const high = Math.max(open, close) * (1 + Math.random() * volatility);
    const low = Math.min(open, close) * (1 - Math.random() * volatility);
    const volume = 100 + Math.random() * 900; // 100-1000 BTC

    candles.push({
      time: startTime + i * intervalMs,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume * 100) / 100,
    });

    price = close;
  }

  return candles;
}

// Generate candles with intentional gaps (missing candles at specific positions)
export function generateCandlesWithGaps(count: number, gapPositions: number[]): Candle[] {
  const allCandles = generateRealisticCandles(count + gapPositions.length);
  return allCandles.filter((_, i) => !gapPositions.includes(i));
}

// Generate candles with some invalid ones
export function generateCandlesWithInvalid(): Candle[] {
  const valid = generateRealisticCandles(10, 40000);

  // Candle with high < low
  const invalidHighLow: Candle = {
    time: new Date("2024-06-01T00:00:00Z").getTime(),
    open: 40000,
    high: 39000, // Invalid: high < low
    low: 41000,
    close: 40500,
    volume: 100,
  };

  // Candle with negative volume
  const invalidVolume: Candle = {
    time: new Date("2024-06-01T01:00:00Z").getTime(),
    open: 40000,
    high: 41000,
    low: 39000,
    close: 40500,
    volume: -100, // Invalid
  };

  // Candle with open outside [low, high]
  const invalidOpen: Candle = {
    time: new Date("2024-06-01T02:00:00Z").getTime(),
    open: 50000, // Outside [39000, 41000]
    high: 41000,
    low: 39000,
    close: 40500,
    volume: 100,
  };

  // Candle with future timestamp
  const invalidFuture: Candle = {
    time: Date.now() + 365 * 24 * 60 * 60 * 1000,
    open: 40000,
    high: 41000,
    low: 39000,
    close: 40500,
    volume: 100,
  };

  return [...valid, invalidHighLow, invalidVolume, invalidOpen, invalidFuture];
}

// Generate dataset with duplicates
export function generateCandlesWithDuplicates(): Candle[] {
  const candles = generateRealisticCandles(10, 40000);
  // Duplicate the first 3 candles
  return [...candles, candles[0]!, candles[1]!, candles[2]!];
}

// Pre-generated fixture: 1000 BTC/USDT 1h candles
export const FIXTURE_1000_CANDLES = generateRealisticCandles(1000);
