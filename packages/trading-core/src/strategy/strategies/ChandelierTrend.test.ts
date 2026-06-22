import { IndicatorCalculator } from "@tb/indicators";
import type { Candle } from "@tb/types";
import { describe, expect, it } from "vitest";

import type { IExchange } from "../../exchange/types";
import { PositionManager } from "../../orders/PositionManager";
import { StrategyContext } from "../StrategyContext";

import { ChandelierTrend } from "./ChandelierTrend";

describe("ChandelierTrend strategy", () => {
  it("buys breakouts above the trend filter", async () => {
    const strategy = new ChandelierTrend();
    await strategy.initialize(createContext());

    const history = buildCandles([
      ...Array.from({ length: 21 }, (_, index) => 100 + index * 0.15),
      108,
    ]);
    const signals = await strategy.onCandle(history.at(-1)!, history);

    expect(signals).toEqual([
      expect.objectContaining({
        action: "BUY",
        symbol: "BTC/USDT",
        orderType: "market",
      }),
    ]);
    expect(signals[0]?.stopLoss).toBeGreaterThan(0);
  });

  it("closes when price breaks the chandelier exit", async () => {
    const strategy = new ChandelierTrend();
    await strategy.initialize(createContext());

    const history = buildCandles([
      ...Array.from({ length: 21 }, (_, index) => 100 + index * 1.2),
      104,
    ]);
    const signals = await strategy.onCandle(history.at(-1)!, history);

    expect(signals).toEqual([
      expect.objectContaining({
        action: "CLOSE_LONG",
        symbol: "BTC/USDT",
        orderType: "market",
      }),
    ]);
  });
});

function createContext() {
  return new StrategyContext(
    new NoopExchange(),
    {
      symbol: "BTC/USDT",
      timeframe: "1h",
      strategyParams: {
        entryPeriod: 5,
        exitPeriod: 5,
        trendPeriod: 20,
        atrPeriod: 3,
        atrStop: 2,
      },
    },
    new IndicatorCalculator(),
    new PositionManager()
  );
}

function buildCandles(closes: number[], start = Date.UTC(2024, 0, 1)): Candle[] {
  return closes.map((close, index) => ({
    time: start + index * 60 * 60 * 1000,
    open: close - 0.4,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100,
  }));
}

class NoopExchange implements IExchange {
  async fetchBalance() {
    return { total: {}, free: {}, used: {} };
  }
  async fetchTicker() {
    throw new Error("not implemented");
  }
  async fetchOHLCV() {
    return [];
  }
  async fetchOrderBook() {
    return { bids: [], asks: [], timestamp: 0 };
  }
  async createOrder() {
    throw new Error("not implemented");
  }
  async cancelOrder() {
    throw new Error("not implemented");
  }
  async fetchOpenOrders() {
    return [];
  }
  async fetchClosedOrders() {
    return [];
  }
  getExchangeId() {
    return "noop";
  }
}
