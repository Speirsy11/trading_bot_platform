import { describe, expect, it, vi } from "vitest";

import { createTrpcContext } from "../context";
import { createCaller } from "../router";

import {
  buildRelativePerformance,
  serializeCoverage,
  summarizeChartCandles,
  type SerializedCandleRow,
} from "./market";

const baseCandles = [
  candle("2024-01-01T00:00:00.000Z", "100", "112", "95", "105", "10"),
  candle("2024-01-01T01:00:00.000Z", "105", "126", "101", "120", "18"),
];

const compareCandles = [
  candle("2024-01-01T00:00:00.000Z", "50", "55", "49", "52", "20"),
  candle("2024-01-01T01:00:00.000Z", "52", "58", "51", "56", "24"),
];

describe("market router chart snapshot", () => {
  it("returns Harvester-backed candles with coverage, summary, and comparison evidence", async () => {
    const getCandles = vi.fn(async ({ symbol }: { symbol: string }) =>
      symbol === "ETH/USDT" ? compareCandles : baseCandles
    );
    const getCoverage = vi.fn().mockResolvedValue({
      earliest: new Date("2024-01-01T00:00:00.000Z"),
      latest: new Date("2024-01-01T01:00:00.000Z"),
      totalCandles: 2,
      gapCount: 0,
    });

    const caller = createCaller(
      createTrpcContext({
        db: {} as never,
        redis: {} as never,
        queues: {} as never,
        exchangeManager: {} as never,
        marketData: {
          getCandles,
          getCoverage,
        } as never,
        keyVault: {} as never,
        exportsDir: "/tmp/exports",
      })
    );

    const result = await caller.market.getChartSnapshot({
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "1h",
      compareSymbol: "ETH/USDT",
      limit: 100,
    });

    expect(getCandles).toHaveBeenCalledTimes(2);
    expect(getCoverage).toHaveBeenCalledWith("binance", "BTC/USDT", "1h");
    expect(getCoverage).toHaveBeenCalledWith("binance", "ETH/USDT", "1h");
    expect(result.candles).toHaveLength(2);
    expect(result.summary.returnPct ?? NaN).toBeCloseTo(20);
    expect(result.summary.totalVolume).toBe(28);
    expect(result.coverage.completeness).toBe(100);
    expect(result.compare?.symbol).toBe("ETH/USDT");
    expect(result.compare?.coverage.completeness).toBe(100);
    expect(result.compare?.summary.returnPct ?? NaN).toBeCloseTo(12);
    expect(result.relativePerformance.at(-1)?.value).toBeCloseTo(14.2857);
  });

  it("summarizes chart evidence without loading more data", () => {
    const candles: SerializedCandleRow[] = [
      serialized(1_700_000_000_000, 10, 12, 9, 11, 4),
      serialized(1_700_003_600_000, 11, 15, 10, 14, 6),
    ];

    expect(summarizeChartCandles(candles, 1_700_003_660_000)).toMatchObject({
      candleCount: 2,
      latestPrice: 14,
      returnPct: 40,
      high: 15,
      low: 9,
      totalVolume: 10,
      latestCandleAgeMs: 60_000,
    });
    expect(buildRelativePerformance(candles).at(-1)?.value).toBeCloseTo(27.2727);
    expect(
      serializeCoverage(
        {
          earliest: new Date("2024-01-01T00:00:00.000Z"),
          latest: new Date("2024-01-01T02:00:00.000Z"),
          totalCandles: 3,
          gapCount: 0,
        },
        "1h",
        Date.parse("2024-01-01T03:00:00.000Z")
      )
    ).toMatchObject({ completeness: 100, latestCandleAgeMs: 3_600_000 });
  });
});

function candle(
  time: string,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string
) {
  return {
    exchange: "binance",
    symbol: "BTC/USDT",
    timeframe: "1h",
    time: new Date(time),
    open,
    high,
    low,
    close,
    volume,
  };
}

function serialized(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): SerializedCandleRow {
  return {
    time,
    open,
    high,
    low,
    close,
    volume,
    tradesCount: 0,
  };
}
