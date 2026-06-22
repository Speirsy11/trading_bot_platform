import { IndicatorCalculator } from "@tb/indicators";
import type { Candle } from "@tb/types";
import { describe, expect, it } from "vitest";

import type { IExchange } from "../../exchange/types";
import { PositionManager } from "../../orders/PositionManager";
import { StrategyContext } from "../StrategyContext";

import { MACDMomentum } from "./MACDMomentum";

describe("MACDMomentum strategy", () => {
  it("buys when MACD histogram turns positive above the trend filter", async () => {
    const strategy = new MACDMomentum();
    await strategy.initialize(
      createContext({
        fastPeriod: 3,
        slowPeriod: 6,
        signalPeriod: 3,
        trendPeriod: 20,
        atrPeriod: 5,
        atrStop: 2,
      })
    );

    const history = buildMomentumRecoveryCandles();
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

  it("closes when momentum turns negative", async () => {
    const strategy = new MACDMomentum();
    await strategy.initialize(
      createContext({
        fastPeriod: 3,
        slowPeriod: 6,
        signalPeriod: 3,
        trendPeriod: 20,
        atrPeriod: 5,
        atrStop: 0,
      })
    );

    const history = [...buildMomentumRecoveryCandles(), ...buildMomentumFailureCandles()];
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
});

function createContext(strategyParams: Record<string, unknown>) {
  return new StrategyContext(
    new NoopExchange(),
    {
      symbol: "BTC/USDT",
      timeframe: "1h",
      strategyParams,
    },
    new IndicatorCalculator(),
    new PositionManager()
  );
}

function buildMomentumRecoveryCandles(): Candle[] {
  const closes = [
    ...Array.from({ length: 35 }, (_, index) => 130 - index),
    106,
    ...Array.from({ length: 40 }, (_, index) => 106 + index * 1.5),
  ];
  return buildCandles(closes);
}

function buildMomentumFailureCandles(): Candle[] {
  const closes = Array.from({ length: 45 }, (_, index) => 138 - index * 1.25);
  return buildCandles(closes, Date.UTC(2024, 0, 4));
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
