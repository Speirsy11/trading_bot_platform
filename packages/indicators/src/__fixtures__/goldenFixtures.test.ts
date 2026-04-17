/**
 * Golden fixture tests — each indicator is verified against pre-computed
 * reference values so any regression in formula or output length is caught
 * immediately.
 */
import { describe, it, expect } from "vitest";

import { macd } from "../momentum/macd";
import { rsi } from "../momentum/rsi";
import { ema } from "../trend/ema";
import { sma } from "../trend/sma";
import { atr } from "../volatility/atr";
import { bollingerBands } from "../volatility/bollingerBands";
import { obv } from "../volume/obv";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Build a minimal Candle array for ATR tests. */
function makeCandles(data: Array<{ high: number; low: number; close: number }>) {
  return data.map((d, i) => ({
    time: i * 60_000,
    open: d.close,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: 1_000,
  }));
}

// ---------------------------------------------------------------------------
// SMA
// ---------------------------------------------------------------------------
describe("SMA golden fixtures", () => {
  // prices [10..16], period 3
  // output length = 7 - 3 + 1 = 5
  // SMA[i] = (prices[i] + prices[i+1] + prices[i+2]) / 3
  const prices = [10, 11, 12, 13, 14, 15, 16];

  it("output length = n - period + 1", () => {
    expect(sma(prices, 3)).toHaveLength(5);
  });

  it("SMA(3) reference values — prices 10..16", () => {
    const result = sma(prices, 3);
    // (10+11+12)/3 = 11, (11+12+13)/3 = 12, ...
    expect(result[0]).toBeCloseTo(11.0, 10);
    expect(result[1]).toBeCloseTo(12.0, 10);
    expect(result[2]).toBeCloseTo(13.0, 10);
    expect(result[3]).toBeCloseTo(14.0, 10);
    expect(result[4]).toBeCloseTo(15.0, 10);
  });

  it("SMA of constant series equals the constant", () => {
    const result = sma([5, 5, 5, 5, 5], 3);
    for (const v of result) expect(v).toBeCloseTo(5, 10);
  });

  it("SMA(1) is the identity", () => {
    expect(sma([3, 7, 2], 1)).toEqual([3, 7, 2]);
  });

  it("returns empty when length < period", () => {
    expect(sma([1, 2], 3)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// EMA
// ---------------------------------------------------------------------------
describe("EMA golden fixtures", () => {
  // Investopedia 10-period EMA dataset (15 prices → 6 output values)
  const prices = [
    22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29, 22.15, 22.39, 22.38,
    22.61, 23.36,
  ];
  const period = 10;
  // k = 2/11 ≈ 0.18182
  // Seed = SMA(prices[0..9]) = 22.221
  // EMA[1] = (22.15 - 22.221) * k + 22.221 ≈ 22.2081
  // EMA[2] = (22.39 - 22.2081) * k + 22.2081 ≈ 22.2412
  // EMA[3] = (22.38 - 22.2412) * k + 22.2412 ≈ 22.2664
  // EMA[4] = (22.61 - 22.2664) * k + 22.2664 ≈ 22.3289
  // EMA[5] = (23.36 - 22.3289) * k + 22.3289 ≈ 22.5164

  it("output length = n - period + 1", () => {
    expect(ema(prices, period)).toHaveLength(6);
  });

  it("EMA[0] is SMA of first period values (seed)", () => {
    const result = ema(prices, period);
    const seed = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    expect(result[0]).toBeCloseTo(seed, 6); // 22.221
  });

  it("EMA reference values — Investopedia period-10 dataset", () => {
    const result = ema(prices, period);
    expect(result[0]).toBeCloseTo(22.221, 2);
    expect(result[1]).toBeCloseTo(22.208, 2);
    expect(result[2]).toBeCloseTo(22.241, 2);
    expect(result[3]).toBeCloseTo(22.266, 2);
    expect(result[4]).toBeCloseTo(22.329, 2);
    expect(result[5]).toBeCloseTo(22.516, 2);
  });

  it("EMA of constant series equals the constant", () => {
    const result = ema([7, 7, 7, 7, 7], 3);
    for (const v of result) expect(v).toBeCloseTo(7, 10);
  });

  it("returns empty when length < period", () => {
    expect(ema([1, 2, 3], 5)).toHaveLength(0);
  });

  it("period-1 EMA seeds at first value and tracks it precisely", () => {
    const vals = [10, 20, 30, 40, 50, 60];
    const result = ema(vals, 3);
    // Seed = SMA(10,20,30) = 20
    expect(result[0]).toBeCloseTo(20, 10);
    // EMA[1] = (40-20)*0.5 + 20 = 30
    expect(result[1]).toBeCloseTo(30, 10);
    // EMA[2] = (50-30)*0.5 + 30 = 40
    expect(result[2]).toBeCloseTo(40, 10);
    // EMA[3] = (60-40)*0.5 + 40 = 50
    expect(result[3]).toBeCloseTo(50, 10);
  });
});

// ---------------------------------------------------------------------------
// RSI
// ---------------------------------------------------------------------------
describe("RSI golden fixtures", () => {
  // Well-known Investopedia 14-period example
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28,
    46.28, 46.0, 46.03, 46.41, 46.22, 46.21,
  ];
  const period = 14;
  // 20 prices → 19 changes → output length = 19 - 14 + 1 = 6
  // Pre-computed via Wilder's smoothing (see task description):
  //   RSI[0] ≈ 70.46
  //   RSI[1] ≈ 66.25
  //   RSI[2] ≈ 66.48
  //   RSI[3] ≈ 69.35
  //   RSI[4] ≈ 66.29
  //   RSI[5] ≈ 66.13

  it("output length = closes.length - period", () => {
    expect(rsi(closes, period)).toHaveLength(6);
  });

  it("RSI reference values — Investopedia 14-period dataset", () => {
    const result = rsi(closes, period);
    expect(result[0]).toBeCloseTo(70.46, 1);
    expect(result[1]).toBeCloseTo(66.25, 1);
    expect(result[2]).toBeCloseTo(66.48, 1);
    expect(result[3]).toBeCloseTo(69.35, 1);
    expect(result[4]).toBeCloseTo(66.29, 1);
    expect(result[5]).toBeCloseTo(66.13, 1);
  });

  it("RSI values are bounded [0, 100]", () => {
    for (const v of rsi(closes, period)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("RSI is 100 for a monotonically rising series", () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(up, period)[0]).toBe(100);
  });

  it("RSI is 0 for a monotonically falling series", () => {
    const down = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi(down, period)[0]).toBe(0);
  });

  it("returns empty when insufficient data", () => {
    expect(rsi([1, 2, 3], 14)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// MACD
// ---------------------------------------------------------------------------
describe("MACD golden fixtures", () => {
  // Pure linear series: prices 100, 101, ..., 149 (50 values)
  // Minimum needed: slowPeriod + signalPeriod - 1 = 26 + 9 - 1 = 34
  // For a linear series in steady state: MACD = 7 exactly
  // (EMA(12) lags price by (12-1)/2=5.5, EMA(26) lags by 12.5 → diff=7)
  const linearPrices = Array.from({ length: 50 }, (_, i) => 100 + i);

  // Oscillating series for non-trivial signal verification
  // prices oscillate ±1 around a rising baseline (e.g. 100,102,101,104,...)
  const oscillatingPrices = [
    100, 102, 101, 104, 103, 106, 105, 108, 107, 110, 109, 112, 111, 114, 113, 116, 115, 118, 117,
    120, 119, 122, 121, 124, 123, 126, 125, 128, 127, 130, 129, 132, 131, 134, 133, 136,
  ];

  it("all three arrays have the same length", () => {
    const r = macd(linearPrices);
    expect(r.macd.length).toBe(r.signal.length);
    expect(r.signal.length).toBe(r.histogram.length);
    expect(r.macd.length).toBeGreaterThan(0);
  });

  it("histogram = MACD - signal at every index", () => {
    const r = macd(linearPrices);
    for (let i = 0; i < r.histogram.length; i++) {
      expect(r.histogram[i]).toBeCloseTo(r.macd[i]! - r.signal[i]!, 10);
    }
  });

  it("MACD line > 0 for a purely rising series", () => {
    const r = macd(linearPrices);
    for (const v of r.macd) expect(v).toBeGreaterThan(0);
  });

  it("MACD converges to 7.0 for a perfectly linear unit-step series", () => {
    // In steady state: EMA(12) - EMA(26) = (26-1)/2 - (12-1)/2 = 12.5 - 5.5 = 7
    const r = macd(linearPrices);
    // Last value is deepest into the series — should be closest to 7
    const last = r.macd[r.macd.length - 1]!;
    expect(last).toBeCloseTo(7.0, 3);
  });

  it("signal line > 0 for a purely rising series", () => {
    const r = macd(linearPrices);
    for (const v of r.signal) expect(v).toBeGreaterThan(0);
  });

  it("MACD[0] reference value for oscillating rising series", () => {
    // Verified via independent computation: ≈ 7.0449
    const r = macd(oscillatingPrices);
    expect(r.macd[0]).toBeCloseTo(7.04, 1);
  });

  it("signal[0] reference value for oscillating rising series", () => {
    // Verified via independent computation: ≈ 7.0050
    const r = macd(oscillatingPrices);
    expect(r.signal[0]).toBeCloseTo(7.0, 1);
  });

  it("returns empty arrays for insufficient data", () => {
    const r = macd([1, 2, 3, 4, 5]);
    expect(r.macd).toHaveLength(0);
    expect(r.signal).toHaveLength(0);
    expect(r.histogram).toHaveLength(0);
  });

  it("throws when fast period >= slow period", () => {
    expect(() => macd(linearPrices, 26, 12, 9)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Bollinger Bands
// ---------------------------------------------------------------------------
describe("Bollinger Bands golden fixtures", () => {
  // period=3, multiplier=2, prices=[20,21,22,23,24]
  // output length = 5 - 3 + 1 = 3
  // Uses population stddev (divides by N)
  // middle[0]=21, stdDev=sqrt(2/3)≈0.8165, upper≈22.633, lower≈19.367
  // middle[1]=22, stdDev=0.8165, upper≈23.633, lower≈20.367
  // middle[2]=23, stdDev=0.8165, upper≈24.633, lower≈21.367
  const prices = [20, 21, 22, 23, 24];

  it("output length = n - period + 1", () => {
    const r = bollingerBands(prices, 3, 2);
    expect(r.upper).toHaveLength(3);
    expect(r.middle).toHaveLength(3);
    expect(r.lower).toHaveLength(3);
  });

  it("middle band equals SMA", () => {
    const r = bollingerBands(prices, 3, 2);
    expect(r.middle[0]).toBeCloseTo(21.0, 10);
    expect(r.middle[1]).toBeCloseTo(22.0, 10);
    expect(r.middle[2]).toBeCloseTo(23.0, 10);
  });

  it("upper and lower bands reference values — period 3, multiplier 2", () => {
    const r = bollingerBands(prices, 3, 2);
    // sqrt(2/3) ≈ 0.81650
    expect(r.upper[0]).toBeCloseTo(22.633, 2);
    expect(r.lower[0]).toBeCloseTo(19.367, 2);
    expect(r.upper[1]).toBeCloseTo(23.633, 2);
    expect(r.lower[1]).toBeCloseTo(20.367, 2);
    expect(r.upper[2]).toBeCloseTo(24.633, 2);
    expect(r.lower[2]).toBeCloseTo(21.367, 2);
  });

  it("upper > middle > lower at every index", () => {
    const r = bollingerBands(prices, 3, 2);
    for (let i = 0; i < r.middle.length; i++) {
      expect(r.upper[i]).toBeGreaterThan(r.middle[i]!);
      expect(r.lower[i]).toBeLessThan(r.middle[i]!);
    }
  });

  it("bands are symmetric around the middle", () => {
    const r = bollingerBands(prices, 3, 2);
    for (let i = 0; i < r.middle.length; i++) {
      const spread = r.upper[i]! - r.middle[i]!;
      expect(r.middle[i]! - r.lower[i]!).toBeCloseTo(spread, 10);
    }
  });

  it("bands collapse to middle for a constant series (zero std dev)", () => {
    const r = bollingerBands([5, 5, 5, 5, 5], 3, 2);
    for (let i = 0; i < r.middle.length; i++) {
      expect(r.upper[i]).toBeCloseTo(r.middle[i]!, 10);
      expect(r.lower[i]).toBeCloseTo(r.middle[i]!, 10);
    }
  });

  it("returns empty for insufficient data", () => {
    const r = bollingerBands([1, 2, 3], 20, 2);
    expect(r.upper).toHaveLength(0);
    expect(r.middle).toHaveLength(0);
    expect(r.lower).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ATR
// ---------------------------------------------------------------------------
describe("ATR golden fixtures", () => {
  // Candles with constant range: H=110, L=100, C=105 every bar
  // TR at each bar (i>=1) = max(10, |110-105|, |100-105|) = max(10, 5, 5) = 10
  // First ATR (period=5) = SMA(10,10,10,10,10) = 10
  // All subsequent ATR = (prev*(5-1)+10)/5 = still 10

  it("ATR converges to range for constant-range candles", () => {
    const candles = makeCandles(
      Array.from({ length: 25 }, () => ({ high: 110, low: 100, close: 105 }))
    );
    const result = atr(candles, 5);
    // output length = 25 - 5 = 20
    expect(result).toHaveLength(20);
    for (const v of result) expect(v).toBeCloseTo(10, 10);
  });

  it("output length = candles.length - period", () => {
    const candles = makeCandles(
      Array.from({ length: 20 }, (_, i) => ({
        high: 100 + i + 5,
        low: 100 + i - 5,
        close: 100 + i,
      }))
    );
    expect(atr(candles, 14)).toHaveLength(6); // 20 - 14 = 6
  });

  it("ATR reference values — 5-candle dataset, period 3", () => {
    // candles: close=[45,49,51,50,48], high=[48,50,53,52,51], low=[43,46,47,48,45]
    // TR: [max(4,5,3), max(6,4,3), max(4,2,1), max(6,2,3)] = [5, 6, 4, 6]
    // ATR[0] = (5+6+4)/3 = 5.0
    // ATR[1] = (5.0*2+6)/3 = 16/3 ≈ 5.3333
    const candles = makeCandles([
      { high: 48, low: 43, close: 45 },
      { high: 50, low: 46, close: 49 },
      { high: 53, low: 47, close: 51 },
      { high: 52, low: 48, close: 50 },
      { high: 51, low: 45, close: 48 },
    ]);
    const result = atr(candles, 3);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(5.0, 10);
    expect(result[1]).toBeCloseTo(5.3333, 3);
  });

  it("ATR is always positive", () => {
    const candles = makeCandles(
      Array.from({ length: 30 }, (_, i) => ({
        high: 100 + (i % 5),
        low: 95 + (i % 3),
        close: 97 + (i % 4),
      }))
    );
    const result = atr(candles, 14);
    for (const v of result) expect(v).toBeGreaterThan(0);
  });

  it("returns empty for insufficient data", () => {
    const candles = makeCandles(
      Array.from({ length: 5 }, () => ({ high: 110, low: 100, close: 105 }))
    );
    expect(atr(candles, 14)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// OBV
// ---------------------------------------------------------------------------
describe("OBV golden fixtures", () => {
  // NOTE: the implementation seeds with volumes[0] (not 0).
  // closes=[100,101,100,102,101], volumes=[1000,1500,800,2000,1200]
  // OBV[0] = 1000  (seed = volumes[0])
  // OBV[1] = 1000+1500=2500  (101 > 100)
  // OBV[2] = 2500-800 =1700  (100 < 101)
  // OBV[3] = 1700+2000=3700  (102 > 100)
  // OBV[4] = 3700-1200=2500  (101 < 102)
  const closes = [100, 101, 100, 102, 101];
  const volumes = [1000, 1500, 800, 2000, 1200];

  it("output length equals input length", () => {
    expect(obv(closes, volumes)).toHaveLength(5);
  });

  it("OBV reference values — standard 5-bar dataset", () => {
    const result = obv(closes, volumes);
    expect(result[0]).toBe(1000); // seed = volumes[0]
    expect(result[1]).toBe(2500); // up: +1500
    expect(result[2]).toBe(1700); // down: -800
    expect(result[3]).toBe(3700); // up: +2000
    expect(result[4]).toBe(2500); // down: -1200
  });

  it("OBV is unchanged on equal closes", () => {
    const result = obv([50, 50, 50], [100, 200, 300]);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(100);
    expect(result[2]).toBe(100);
  });

  it("OBV accumulates all volume on a monotonically rising series", () => {
    const c = [10, 11, 12, 13];
    const v = [100, 200, 300, 400];
    const result = obv(c, v);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(300);
    expect(result[2]).toBe(600);
    expect(result[3]).toBe(1000);
  });

  it("OBV subtracts all volume on a monotonically falling series", () => {
    const c = [13, 12, 11, 10];
    const v = [100, 200, 300, 400];
    const result = obv(c, v);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(-100); // 100-200
    expect(result[2]).toBe(-400); // -100-300
    expect(result[3]).toBe(-800); // -400-400
  });

  it("returns empty for empty input", () => {
    expect(obv([], [])).toHaveLength(0);
  });
});
