import { describe, expect, it } from "vitest";

import { backtestConfigSchema, botPromotionEvidenceSchema, dataExportSchema } from "./schemas";

describe("trpc schemas", () => {
  it("limits data exports to Signal Harvester canonical candle intervals", () => {
    const baseInput = {
      exchange: "binance",
      symbols: ["BTC/USDT"],
      startTime: Date.parse("2026-01-01T00:00:00.000Z"),
      endTime: Date.parse("2026-01-02T00:00:00.000Z"),
      format: "csv" as const,
    };

    expect(
      dataExportSchema.parse({
        ...baseInput,
        timeframe: "15m",
      }).timeframe
    ).toBe("15m");
    expect(() =>
      dataExportSchema.parse({
        ...baseInput,
        timeframe: "5m",
      })
    ).toThrow();
    expect(() =>
      dataExportSchema.parse({
        ...baseInput,
        timeframe: "1d",
      })
    ).toThrow();
  });

  it("normalizes and deduplicates data export symbols", () => {
    const parsed = dataExportSchema.parse({
      exchange: "binance",
      symbols: ["btc/usdt", " BTC/USDT ", "eth/usdt"],
      timeframe: "1h",
      startTime: Date.parse("2026-01-01T00:00:00.000Z"),
      endTime: Date.parse("2026-01-02T00:00:00.000Z"),
      format: "csv",
    });

    expect(parsed.symbols).toEqual(["BTC/USDT", "ETH/USDT"]);
  });

  it("preserves execution assumptions in bot promotion evidence", () => {
    const parsed = botPromotionEvidenceSchema.parse({
      sourceType: "research",
      sourceId: "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f",
      sourceSweepId: "c754aa45-64a2-446c-a0cf-e4f76236c201",
      executionAssumptions: {
        marketMode: "spot",
        initialBalance: 25_000,
        fees: { maker: 0.0008, taker: 0.0012 },
        slippage: { enabled: true, percentage: 0.0007 },
      },
    });

    expect(parsed?.executionAssumptions).toEqual({
      marketMode: "spot",
      initialBalance: 25_000,
      fees: { maker: 0.0008, taker: 0.0012 },
      slippage: { enabled: true, percentage: 0.0007 },
    });
  });

  it("rejects backtests and exports with non-chronological time windows", () => {
    const startTime = Date.parse("2026-01-02T00:00:00.000Z");
    const endTime = Date.parse("2026-01-01T00:00:00.000Z");

    expect(() =>
      backtestConfigSchema.parse({
        name: "Invalid window",
        strategy: "sma-crossover",
        strategyParams: { fastPeriod: 50, slowPeriod: 200 },
        exchange: "binance",
        symbol: "BTC/USDT",
        timeframe: "1h",
        startTime,
        endTime,
        initialBalance: 10_000,
      })
    ).toThrow(/endTime must be after startTime/);

    expect(() =>
      dataExportSchema.parse({
        exchange: "binance",
        symbols: ["BTC/USDT"],
        timeframe: "1h",
        startTime,
        endTime,
        format: "csv",
      })
    ).toThrow(/endTime must be after startTime/);
  });
});
