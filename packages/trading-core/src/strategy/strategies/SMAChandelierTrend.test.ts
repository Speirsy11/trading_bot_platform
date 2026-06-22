import { IndicatorCalculator } from "@tb/indicators";
import type { Candle } from "@tb/types";
import { describe, expect, it } from "vitest";

import type { IExchange } from "../../exchange/types";
import { PositionManager } from "../../orders/PositionManager";
import { StrategyContext } from "../StrategyContext";

import { SMAChandelierTrend } from "./SMAChandelierTrend";

describe("SMAChandelierTrend strategy", () => {
  it("buys when price reclaims the fast average in a bullish SMA regime", async () => {
    const strategy = new SMAChandelierTrend();
    await strategy.initialize(createContext());

    const history = buildCandles([
      ...Array.from({ length: 24 }, (_, index) => 100 + index * 0.4),
      106,
      105,
      104,
      107,
    ]);

    let buySignal = null;
    for (let index = 0; index < history.length; index++) {
      const candle = history[index]!;
      const signals = await strategy.onCandle(candle, history.slice(0, index + 1));
      buySignal = signals.find((signal) => signal.action === "BUY") ?? buySignal;
    }

    expect(buySignal).toEqual(
      expect.objectContaining({
        action: "BUY",
        symbol: "BTC/USDT",
        orderType: "market",
      })
    );
    expect(buySignal?.stopLoss).toBeGreaterThan(0);
  });

  it("closes when the chandelier stop fails", async () => {
    const strategy = new SMAChandelierTrend();
    await strategy.initialize(createContext());

    const history = buildCandles([
      ...Array.from({ length: 24 }, (_, index) => 100 + index * 0.7),
      118,
      119,
      120,
      105,
    ]);

    let closeSignal = null;
    for (let index = 0; index < history.length; index++) {
      const candle = history[index]!;
      const signals = await strategy.onCandle(candle, history.slice(0, index + 1));
      closeSignal = signals.find((signal) => signal.action === "CLOSE_LONG") ?? closeSignal;
    }

    expect(closeSignal).toEqual(
      expect.objectContaining({
        action: "CLOSE_LONG",
        symbol: "BTC/USDT",
        orderType: "market",
      })
    );
  });

  it("does not buy when the computed chandelier stop would be above entry", async () => {
    const strategy = new SMAChandelierTrend();
    await strategy.initialize(createContext());

    const history = buildCandles([
      ...Array.from({ length: 24 }, (_, index) => 100 + index * 0.7),
      120,
      104,
      103,
      107,
    ]);

    let unsafeBuy = null;
    for (let index = 0; index < history.length; index++) {
      const candle = history[index]!;
      const signals = await strategy.onCandle(candle, history.slice(0, index + 1));
      unsafeBuy =
        signals.find(
          (signal) =>
            signal.action === "BUY" &&
            signal.stopLoss !== undefined &&
            signal.stopLoss >= candle.close
        ) ?? unsafeBuy;
    }

    expect(unsafeBuy).toBeNull();
  });
});

function createContext() {
  return new StrategyContext(
    new NoopExchange(),
    {
      symbol: "BTC/USDT",
      timeframe: "1h",
      strategyParams: {
        fastPeriod: 5,
        slowPeriod: 20,
        exitPeriod: 5,
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
