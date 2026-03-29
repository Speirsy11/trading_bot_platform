import type { Candle } from "@tb/types";

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export interface StochasticResult {
  k: number[];
  d: number[];
}

export interface VWAPResult {
  vwap: number[];
  upperBand?: number[];
  lowerBand?: number[];
}

export type IndicatorInput = number[] | Candle[];
