import { describe, expect, it } from "vitest";

import type { MarketQualityMetric } from "./harvesterMarketData";
import {
  assertNativeResearchRollupsReady,
  summarizeResearchDataReadiness,
} from "./researchReadiness";

function metric(
  symbol: string,
  timeframe: string,
  status: string,
  totalCandles = 100,
  overrides: Partial<MarketQualityMetric> = {}
): MarketQualityMetric {
  return {
    exchange: "binance",
    symbol,
    timeframe,
    totalCandles,
    gapCount: 0,
    earliest: totalCandles > 0 ? "2024-01-01T00:00:00.000Z" : null,
    latest: totalCandles > 0 ? "2024-01-02T00:00:00.000Z" : null,
    startTime: totalCandles > 0 ? "2024-01-01T00:00:00.000Z" : null,
    nextStartTime: null,
    latestAvailableTime: totalCandles > 0 ? "2024-01-02T00:00:00.000Z" : null,
    latestCandleAgeMs: 0,
    websocketStatus: "external",
    restFallbackCount: 0,
    validationFailures: 0,
    apiErrors: 0,
    repairFailures: 0,
    backfillBacklog: 0,
    candlesInserted: totalCandles,
    missingCandles: 0,
    completenessPct: totalCandles > 0 ? "100.00" : "0.00",
    lastUpdated: totalCandles > 0 ? "2024-01-02T00:01:00.000Z" : null,
    status,
    ...overrides,
  };
}

describe("summarizeResearchDataReadiness", () => {
  it("requires complete native rollups for every requested symbol and timeframe", () => {
    const readiness = summarizeResearchDataReadiness(
      [
        metric("BTC/USDT", "15m", "complete"),
        metric("BTC/USDT", "1h", "complete"),
        metric("ETH/USDT", "15m", "running", 0),
      ],
      {
        symbols: ["BTC/USDT", "ETH/USDT"],
        timeframes: ["15m", "1h"],
      }
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.readyCount).toBe(2);
    expect(readiness.blockingCount).toBe(2);
    expect(readiness.runningCount).toBe(1);
    expect(readiness.missingCount).toBe(1);
    expect(readiness.blockingItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: "ETH/USDT", timeframe: "15m", status: "running" }),
        expect.objectContaining({ symbol: "ETH/USDT", timeframe: "1h", status: "missing" }),
      ])
    );
  });

  it("marks the set ready only when all metrics are complete and populated", () => {
    const readiness = summarizeResearchDataReadiness(
      [metric("BTC/USDT", "4h", "complete"), metric("ETH/USDT", "4h", "complete")],
      {
        symbols: ["BTC/USDT", "ETH/USDT"],
        timeframes: ["4h"],
      }
    );

    expect(readiness.ready).toBe(true);
    expect(readiness.readyCount).toBe(2);
    expect(readiness.blockingCount).toBe(0);
    expect(readiness.blockingItems).toEqual([]);
    expect(readiness.latestUpdated).toBe("2024-01-02T00:01:00.000Z");
  });

  it("blocks sparse complete rollups instead of trusting status alone", () => {
    const readiness = summarizeResearchDataReadiness(
      [
        metric("BTC/USDT", "4h", "complete", 90, {
          earliest: "2024-01-01T00:00:00.000Z",
          latest: "2024-01-31T20:00:00.000Z",
          missingCandles: 96,
          completenessPct: "48.39",
        }),
      ],
      {
        symbols: ["BTC/USDT"],
        timeframes: ["4h"],
      }
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.readyCount).toBe(0);
    expect(readiness.blockingItems).toEqual([
      expect.objectContaining({ symbol: "BTC/USDT", timeframe: "4h", status: "pending" }),
    ]);
  });

  it("treats an idle rollup as ready when its cursor already covers the latest available candle", () => {
    const readiness = summarizeResearchDataReadiness(
      [
        metric("BTC/USDT", "15m", "idle", 100, {
          nextStartTime: "2024-01-02T00:00:00.000Z",
          latestAvailableTime: "2024-01-02T00:03:00.000Z",
        }),
        metric("ETH/USDT", "15m", "idle", 100, {
          nextStartTime: "2024-01-01T12:00:00.000Z",
          latestAvailableTime: "2024-01-02T00:03:00.000Z",
        }),
      ],
      {
        symbols: ["BTC/USDT", "ETH/USDT"],
        timeframes: ["15m"],
      }
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.readyCount).toBe(1);
    expect(readiness.blockingItems).toEqual([
      expect.objectContaining({ symbol: "ETH/USDT", timeframe: "15m", status: "pending" }),
    ]);
  });

  it("throws a readable readiness error unless fallback rollups are explicitly allowed", async () => {
    const marketData = {
      getQualityMetrics: async () => [
        metric("BTC/USDT", "4h", "complete"),
        metric("ETH/USDT", "4h", "idle", 0),
      ],
    };

    await expect(
      assertNativeResearchRollupsReady(marketData as never, {
        symbols: ["BTC/USDT", "ETH/USDT"],
        timeframes: ["4h"],
      })
    ).rejects.toThrow(
      "Native Harvester rollups are ready for 1/2 requested symbol/timeframe pairs; 1 still block the sweep: ETH/USDT 4h pending"
    );

    await expect(
      assertNativeResearchRollupsReady(marketData as never, {
        symbols: ["BTC/USDT", "ETH/USDT"],
        timeframes: ["4h"],
        allowFallbackRollups: true,
      })
    ).resolves.toMatchObject({ ready: false, blockingCount: 1 });
  });
});
