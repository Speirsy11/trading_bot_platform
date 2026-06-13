import { describe, expect, it } from "vitest";

import {
  allowLocalMarketDataFallback,
  createCanonicalMarketDataReader,
  createHarvesterMarketDataReaderFromSql,
  fromHarvesterInterval,
  fromHarvesterSymbol,
  nativeCoversRange,
  rollupCandles,
  toHarvesterInterval,
  toHarvesterSymbol,
} from "./harvesterMarketData";

describe("harvester market data helpers", () => {
  it("fails fast when canonical Harvester data is not configured", () => {
    expect(() =>
      createCanonicalMarketDataReader({
        db: {} as never,
        env: {},
      })
    ).toThrow(/SIGNAL_HARVESTER_DATABASE_URL must be set/);
  });

  it("keeps local market-data fallback explicit for tests and fixtures", () => {
    expect(allowLocalMarketDataFallback({ MARKET_DATA_ALLOW_LOCAL_FALLBACK: "true" })).toBe(true);
    expect(allowLocalMarketDataFallback({ APP_MODE: "testing" })).toBe(true);
    expect(allowLocalMarketDataFallback({ NODE_ENV: "test" })).toBe(true);
    expect(allowLocalMarketDataFallback({ NODE_ENV: "production" })).toBe(false);
    expect(() =>
      createCanonicalMarketDataReader({
        db: {} as never,
        env: { MARKET_DATA_ALLOW_LOCAL_FALLBACK: "true" },
      })
    ).not.toThrow();
  });

  it("uses actual stored point counts for one-minute coverage", async () => {
    const queries: string[] = [];
    const sql = ((strings: TemplateStringsArray) => {
      queries.push(strings.join("?"));
      return Promise.resolve([
        {
          earliest: new Date("2026-01-01T00:00:00.000Z"),
          latest: new Date("2026-01-01T23:58:00.000Z"),
          total_candles: "1439",
        },
      ]);
    }) as never;
    const reader = createHarvesterMarketDataReaderFromSql(sql);

    const coverage = await reader.getCoverage("binance", "BTC/USDT", "1m");

    expect(coverage).toEqual({
      earliest: new Date("2026-01-01T00:00:00.000Z"),
      latest: new Date("2026-01-01T23:58:00.000Z"),
      totalCandles: 1439,
      gapCount: 0,
    });
    expect(queries[0]).toContain("COUNT(*) AS total_candles");
    expect(queries[0]).not.toContain("FROM market_data_backfills b");
  });

  it("uses market_data_points counts for quality metrics instead of backfill counters", async () => {
    const queries: string[] = [];
    const sql = ((strings: TemplateStringsArray) => {
      queries.push(strings.join("?"));
      return Promise.resolve([
        {
          exchange: "binance",
          symbol: "BTCUSDT",
          timeframe: "15m",
          status: "complete",
          earliest: new Date("2026-01-01T00:00:00.000Z"),
          latest: new Date("2026-01-01T01:00:00.000Z"),
          total_candles: "4",
          start_time: new Date("2026-01-01T00:00:00.000Z"),
          next_start_time: new Date("2026-01-01T01:15:00.000Z"),
          latest_available_time: new Date("2026-01-01T01:14:00.000Z"),
          updated_at: new Date("2026-01-01T01:15:00.000Z"),
        },
      ]);
    }) as never;
    const reader = createHarvesterMarketDataReaderFromSql(sql);

    const [metric] = await reader.getQualityMetrics({ exchange: "binance", symbol: "BTC/USDT" });

    expect(metric).toMatchObject({
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "15m",
      totalCandles: 4,
      status: "complete",
    });
    expect(queries.some((query) => query.includes("point_stats.total_candles"))).toBe(true);
    expect(queries.some((query) => query.includes("COUNT(*) AS total_candles"))).toBe(true);
  });

  it("normalizes symbols between platform and Signal Harvester formats", () => {
    expect(toHarvesterSymbol("BTC/USDT")).toBe("BTCUSDT");
    expect(toHarvesterSymbol("eth/usdt")).toBe("ETHUSDT");
    expect(fromHarvesterSymbol("BTCUSDT")).toBe("BTC/USDT");
    expect(fromHarvesterSymbol("BTC/USDT")).toBe("BTC/USDT");
  });

  it("normalizes interval names between platform and Signal Harvester formats", () => {
    expect(toHarvesterInterval("15m")).toBe("15m");
    expect(toHarvesterInterval("1w")).toBe("1W");
    expect(fromHarvesterInterval("1W")).toBe("1w");
    expect(fromHarvesterInterval("4h")).toBe("4h");
  });

  it("rolls one-minute candles into higher timeframe OHLCV candles", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const candles = Array.from({ length: 15 }, (_, index) => ({
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "1m",
      time: new Date(start + index * 60_000),
      open: String(100 + index),
      high: String(101 + index),
      low: String(99 + index),
      close: String(100.5 + index),
      volume: "2",
      tradesCount: 1,
    }));

    const rolled = rollupCandles(candles, "15m");

    expect(rolled).toHaveLength(1);
    expect(rolled[0]).toMatchObject({
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "15m",
      open: "100",
      high: "115",
      low: "99",
      close: "114.5",
      volume: "30",
      tradesCount: 15,
    });
  });

  it("uses native interval coverage only when it spans the requested range", () => {
    const params = {
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "4h",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
      endTime: new Date("2026-01-31T00:00:00.000Z"),
    };

    expect(
      nativeCoversRange(
        {
          earliest: new Date("2026-01-01T00:00:00.000Z"),
          latest: new Date("2026-01-30T20:00:00.000Z"),
          totalCandles: 180,
          gapCount: 0,
        },
        params
      )
    ).toBe(true);

    expect(
      nativeCoversRange(
        {
          earliest: new Date("2026-01-15T00:00:00.000Z"),
          latest: new Date("2026-01-30T20:00:00.000Z"),
          totalCandles: 96,
          gapCount: 0,
        },
        params
      )
    ).toBe(false);

    expect(
      nativeCoversRange(
        {
          earliest: new Date("2026-01-01T00:00:00.000Z"),
          latest: new Date("2026-01-30T20:00:00.000Z"),
          totalCandles: 90,
          gapCount: 0,
        },
        params
      )
    ).toBe(false);
  });

  it("allows native rollups to end at the latest closed bucket", () => {
    expect(
      nativeCoversRange(
        {
          earliest: new Date("2026-01-01T00:00:00.000Z"),
          latest: new Date("2026-01-31T08:00:00.000Z"),
          totalCandles: 183,
          gapCount: 0,
        },
        {
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "4h",
          startTime: new Date("2026-01-01T00:00:00.000Z"),
          endTime: new Date("2026-01-31T15:02:00.000Z"),
        }
      )
    ).toBe(true);
  });

  it("rejects sparse native rollup coverage even when a shorter requested range fits inside it", () => {
    expect(
      nativeCoversRange(
        {
          earliest: new Date("2026-01-01T00:00:00.000Z"),
          latest: new Date("2026-01-31T20:00:00.000Z"),
          totalCandles: 90,
          gapCount: 0,
        },
        {
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "4h",
          startTime: new Date("2026-01-15T00:00:00.000Z"),
          endTime: new Date("2026-01-16T00:00:00.000Z"),
        }
      )
    ).toBe(false);
  });
});
