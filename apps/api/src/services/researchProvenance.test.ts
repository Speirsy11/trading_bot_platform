import type { backtests, researchResults } from "@tb/db";
import { describe, expect, it } from "vitest";

import {
  assertResearchReplayWindowMatches,
  assertBacktestReplayConfigMatches,
  assertResearchReplayConfigMatches,
  canonicalJsonEqual,
} from "./researchProvenance";

describe("research provenance", () => {
  const row = {
    id: "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f",
    strategy: "bollinger-long-bounce",
    strategyParams: {
      exitBand: "upper",
      period: 20,
      rsiOversold: 35,
      stdDevMultiplier: 2,
    },
    timeframe: "1h",
    symbols: ["BTC/USDT", "ETH/USDT"],
    dataCoverage: [
      {
        symbol: "BTC/USDT",
        earliest: "2026-01-01T00:00:00.000Z",
        latest: "2026-02-01T00:00:00.000Z",
      },
      {
        symbol: "ETH/USDT",
        earliest: "2026-01-02T00:00:00.000Z",
        latest: "2026-02-02T00:00:00.000Z",
      },
    ],
  } as typeof researchResults.$inferSelect;

  it("compares strategy params canonically so key order is irrelevant", () => {
    expect(canonicalJsonEqual({ b: 2, a: { d: 4, c: 3 } }, { a: { c: 3, d: 4 }, b: 2 })).toBe(true);
  });

  it("allows exact symbol-level replays from a portfolio research result", () => {
    expect(() =>
      assertResearchReplayConfigMatches(row, {
        strategy: "bollinger-long-bounce",
        strategyParams: {
          period: 20,
          stdDevMultiplier: 2,
          rsiOversold: 35,
          exitBand: "upper",
        },
        symbol: "btc/usdt",
        timeframe: "1h",
      })
    ).not.toThrow();
  });

  it("rejects provenance when strategy, timeframe, params, or symbol drift", () => {
    expect(() =>
      assertResearchReplayConfigMatches(row, {
        strategy: "bollinger-long-bounce",
        strategyParams: {
          period: 20,
          stdDevMultiplier: 2,
          rsiOversold: 35,
          exitBand: "middle",
        },
        symbol: "SOL/USDT",
        timeframe: "4h",
      })
    ).toThrow(/exact research replays/);
  });

  it("allows exact research replay windows from source data coverage", () => {
    expect(() =>
      assertResearchReplayWindowMatches(row, {
        strategy: "bollinger-long-bounce",
        strategyParams: {},
        symbol: "btc/usdt",
        timeframe: "1h",
        startTime: Date.parse("2026-01-01T00:00:00.000Z"),
        endTime: Date.parse("2026-02-01T00:00:00.000Z"),
      })
    ).not.toThrow();
  });

  it("rejects research replay windows that drift from source data coverage", () => {
    expect(() =>
      assertResearchReplayWindowMatches(row, {
        strategy: "bollinger-long-bounce",
        strategyParams: {},
        symbol: "BTC/USDT",
        timeframe: "1h",
        startTime: Date.parse("2026-01-03T00:00:00.000Z"),
        endTime: Date.parse("2026-02-01T00:00:00.000Z"),
      })
    ).toThrow(/replay time window does not match/);
  });

  it("rejects backtest provenance when exchange, strategy, timeframe, symbol, or params drift", () => {
    const backtestRow = {
      id: "2f297746-8cd2-47d1-8b3e-198489bb8e78",
      exchange: "binance",
      strategy: "sma-crossover",
      strategyParams: { fastPeriod: 50, slowPeriod: 200 },
      symbol: "BTC/USDT",
      timeframe: "15m",
    } as typeof backtests.$inferSelect;

    expect(() =>
      assertBacktestReplayConfigMatches(backtestRow, {
        exchange: "coinbase",
        strategy: "sma-crossover",
        strategyParams: { fastPeriod: 9, slowPeriod: 21 },
        symbol: "SOL/USDT",
        timeframe: "1h",
      })
    ).toThrow(/exact backtest replays/);
  });
});
