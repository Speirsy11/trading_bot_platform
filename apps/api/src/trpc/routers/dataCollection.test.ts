import { describe, expect, it, vi } from "vitest";

import type { MarketQualityMetric } from "../../services/harvesterMarketData";
import { createTrpcContext } from "../context";
import { createCaller } from "../router";

describe("data collection router", () => {
  it("reports collection status from the canonical market data reader", async () => {
    const getQualityMetrics = vi.fn(async () => [
      metric("ETH/USDT", "1h", "running", 24, "2026-05-30T10:00:00.000Z"),
      metric("BTC/USDT", "15m", "complete", 96, "2026-05-30T09:00:00.000Z"),
      metric("BTC/USDT", "1h", "complete", 24, "2026-05-30T11:00:00.000Z"),
    ]);
    const dbSelect = vi.fn(() => {
      throw new Error("dataCollection.status must not read platform-local status rows");
    });

    const caller = createCaller(
      createTrpcContext({
        db: { select: dbSelect } as never,
        redis: {} as never,
        queues: {} as never,
        exchangeManager: {} as never,
        marketData: { getQualityMetrics } as never,
        keyVault: {} as never,
        exportsDir: "/tmp/exports",
      })
    );

    const rows = await caller.dataCollection.status({
      exchange: "binance",
      timeframe: "1h",
    });

    expect(getQualityMetrics).toHaveBeenCalledWith({
      exchange: "binance",
      symbol: undefined,
    });
    expect(dbSelect).not.toHaveBeenCalled();
    expect(rows).toEqual([
      {
        exchange: "binance",
        symbol: "BTC/USDT",
        timeframe: "1h",
        status: "complete",
        earliest: "2026-05-30T00:00:00.000Z",
        latest: "2026-05-30T11:00:00.000Z",
        totalCandles: 24,
        gapCount: 0,
        lastCollectedAt: "2026-05-30T11:01:00.000Z",
      },
      {
        exchange: "binance",
        symbol: "ETH/USDT",
        timeframe: "1h",
        status: "running",
        earliest: "2026-05-30T00:00:00.000Z",
        latest: "2026-05-30T10:00:00.000Z",
        totalCandles: 24,
        gapCount: 0,
        lastCollectedAt: "2026-05-30T10:01:00.000Z",
      },
    ]);
  });
});

function metric(
  symbol: string,
  timeframe: string,
  status: string,
  totalCandles: number,
  latest: string
): MarketQualityMetric {
  return {
    exchange: "binance",
    symbol,
    timeframe,
    totalCandles,
    gapCount: 0,
    earliest: "2026-05-30T00:00:00.000Z",
    latest,
    startTime: "2026-05-30T00:00:00.000Z",
    nextStartTime: null,
    latestAvailableTime: latest,
    latestCandleAgeMs: 60_000,
    websocketStatus: "external",
    restFallbackCount: 0,
    validationFailures: 0,
    apiErrors: 0,
    repairFailures: 0,
    backfillBacklog: 0,
    candlesInserted: totalCandles,
    missingCandles: 0,
    completenessPct: "100.00",
    lastUpdated: new Date(Date.parse(latest) + 60_000).toISOString(),
    status,
  };
}
