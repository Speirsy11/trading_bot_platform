import type { BotOrderFill } from "@tb/trading-core";
import type { Balance } from "@tb/types";
import { describe, expect, it } from "vitest";

import type { MarketCandle, MarketDataReader } from "../services/harvesterMarketData";

import {
  assertMarketDataReady,
  calculateSpotEquity,
  createMarketDataCandleSource,
  mapOrderFillToBotTrade,
} from "./botExecutor";

describe("bot executor fill persistence helpers", () => {
  it("maps a filled order and realised trade into a bot trade insert", () => {
    const timestamp = Date.UTC(2026, 0, 1, 12);
    const fill: BotOrderFill = {
      reason: "strategy-exit",
      order: {
        id: "paper-7",
        symbol: "BTC/USDT",
        side: "sell",
        type: "market",
        amount: 0.5,
        filled: 0.5,
        remaining: 0,
        price: 112,
        cost: 56,
        status: "closed",
        timestamp,
        fee: { cost: 0.1, currency: "USDT" },
      },
      signal: {
        action: "SELL",
        symbol: "BTC/USDT",
        orderType: "market",
        reason: "signal-exit",
      },
      trade: {
        id: "trade-1",
        orderId: "paper-7",
        symbol: "BTC/USDT",
        side: "sell",
        type: "market",
        amount: 0.5,
        price: 112,
        cost: 56,
        fee: 0.1,
        pnl: 5.9,
        entryPrice: 100,
        exitPrice: 112,
        entryTimestamp: timestamp - 60_000,
        timestamp,
        reason: "strategy",
      },
    };

    const row = mapOrderFillToBotTrade("bot-1", fill);

    expect(row).toMatchObject({
      botId: "bot-1",
      orderId: "paper-7",
      symbol: "BTC/USDT",
      side: "sell",
      type: "market",
      amount: "0.5",
      price: "112",
      cost: "56",
      fee: "0.1",
      feeCurrency: "USDT",
      pnl: "5.9",
      reason: "strategy",
      executedAt: new Date(timestamp),
    });
    expect(Number(row.pnlPercent)).toBeCloseTo(11.8, 8);
  });

  it("marks spot paper equity using base inventory plus quote balance", () => {
    const balance: Balance = {
      total: { USDT: 125, BTC: 0.25 },
      free: { USDT: 125, BTC: 0.25 },
      used: {},
    };

    expect(calculateSpotEquity(balance, "BTC/USDT", 40_000)).toBe(10_125);
  });

  it("polls paper bot candles through the shared MarketDataReader", async () => {
    const reader = new FakeMarketDataReader([
      candle("2026-01-01T00:00:00.000Z", "100", "110", "90", "105", "12"),
      candle("2026-01-01T00:15:00.000Z", "105", "115", "101", "112", "18"),
    ]);

    const source = createMarketDataCandleSource(reader, "binance", "BTC/USDT", "15m");
    const rows = await source(Date.parse("2026-01-01T00:00:00.000Z"), 2);

    expect(reader.getCandlesCalls).toEqual([
      expect.objectContaining({
        exchange: "binance",
        symbol: "BTC/USDT",
        timeframe: "15m",
        startTime: new Date("2026-01-01T00:00:00.000Z"),
        limit: 2,
      }),
    ]);
    expect(rows).toEqual([
      {
        time: Date.parse("2026-01-01T00:00:00.000Z"),
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 12,
      },
      {
        time: Date.parse("2026-01-01T00:15:00.000Z"),
        open: 105,
        high: 115,
        low: 101,
        close: 112,
        volume: 18,
      },
    ]);
  });

  it("rejects bot startup when canonical market data is missing or stale", async () => {
    await expect(
      assertMarketDataReady(new FakeMarketDataReader([]), "binance", "BTC/USDT", "15m")
    ).rejects.toThrow("No canonical market data available");

    const previousStaleness = process.env["BOT_MAX_MARKET_DATA_STALENESS_MS"];
    process.env["BOT_MAX_MARKET_DATA_STALENESS_MS"] = "1000";

    try {
      await expect(
        assertMarketDataReady(
          new FakeMarketDataReader([
            candle("2026-01-01T00:00:00.000Z", "100", "110", "90", "105", "12"),
          ]),
          "binance",
          "BTC/USDT",
          "15m"
        )
      ).rejects.toThrow("Canonical market data is stale");
    } finally {
      if (previousStaleness === undefined) {
        delete process.env["BOT_MAX_MARKET_DATA_STALENESS_MS"];
      } else {
        process.env["BOT_MAX_MARKET_DATA_STALENESS_MS"] = previousStaleness;
      }
    }
  });
});

class FakeMarketDataReader implements MarketDataReader {
  readonly getCandlesCalls: Array<Parameters<MarketDataReader["getCandles"]>[0]> = [];

  constructor(private readonly candles: MarketCandle[]) {}

  async getLatestCandle() {
    return this.candles.at(-1) ?? null;
  }

  async getCandles(params: Parameters<MarketDataReader["getCandles"]>[0]) {
    this.getCandlesCalls.push(params);
    return this.candles.slice(-params.limit);
  }

  async *streamCandles() {
    yield this.candles;
  }

  async getSymbols() {
    return ["BTC/USDT"];
  }

  async getCoverage() {
    return {
      earliest: this.candles[0]?.time ?? null,
      latest: this.candles.at(-1)?.time ?? null,
      totalCandles: this.candles.length,
      gapCount: 0,
    };
  }

  async getQualityMetrics() {
    return [];
  }
}

function candle(
  time: string,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string
): MarketCandle {
  return {
    exchange: "binance",
    symbol: "BTC/USDT",
    timeframe: "15m",
    time: new Date(time),
    open,
    high,
    low,
    close,
    volume,
    tradesCount: 0,
  };
}
