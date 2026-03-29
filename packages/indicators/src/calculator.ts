import type { Candle } from "@tb/types";

import { macd } from "./momentum/macd.js";
import { rsi } from "./momentum/rsi.js";
import { stochastic } from "./momentum/stochastic.js";
import { adx } from "./trend/adx.js";
import { ema } from "./trend/ema.js";
import { sma } from "./trend/sma.js";
import type { BollingerBandsResult, MACDResult, StochasticResult } from "./types.js";
import { atr } from "./volatility/atr.js";
import { bollingerBands } from "./volatility/bollingerBands.js";
import { obv } from "./volume/obv.js";
import { vwap } from "./volume/vwap.js";

/**
 * Unified indicator calculator that strategies consume.
 * Wraps all indicator functions with a clean API.
 */
export class IndicatorCalculator {
  sma(values: number[], period: number): number[] {
    return sma(values, period);
  }

  ema(values: number[], period: number): number[] {
    return ema(values, period);
  }

  rsi(values: number[], period: number = 14): number[] {
    return rsi(values, period);
  }

  macd(
    values: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): MACDResult {
    return macd(values, fastPeriod, slowPeriod, signalPeriod);
  }

  adx(
    candles: Candle[],
    period: number = 14
  ): { adx: number[]; plusDI: number[]; minusDI: number[] } {
    return adx(candles, period);
  }

  stochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    kPeriod: number = 14,
    dPeriod: number = 3
  ): StochasticResult {
    return stochastic(highs, lows, closes, kPeriod, dPeriod);
  }

  bollingerBands(
    values: number[],
    period: number = 20,
    stdDevMultiplier: number = 2
  ): BollingerBandsResult {
    return bollingerBands(values, period, stdDevMultiplier);
  }

  atr(candles: Candle[], period: number = 14): number[] {
    return atr(candles, period);
  }

  obv(closes: number[], volumes: number[]): number[] {
    return obv(closes, volumes);
  }

  vwap(candles: Candle[]): number[] {
    return vwap(candles);
  }
}
