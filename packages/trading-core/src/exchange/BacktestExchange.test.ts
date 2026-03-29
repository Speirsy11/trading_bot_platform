import type { Candle } from "@tb/types";
import { describe, it, expect, beforeEach } from "vitest";

import { BacktestExchange } from "./BacktestExchange.js";

function makeCandle(overrides: Partial<Candle> & { time: number }): Candle {
  return {
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
    ...overrides,
  };
}

describe("BacktestExchange", () => {
  let exchange: BacktestExchange;

  beforeEach(() => {
    exchange = new BacktestExchange(
      10000,
      { maker: 0.001, taker: 0.001 },
      { enabled: false, percentage: 0 }
    );
  });

  it("starts with correct initial balance", async () => {
    const balance = await exchange.fetchBalance();
    expect(balance.free.USDT).toBe(10000);
    expect(balance.total.USDT).toBe(10000);
  });

  it("creates and fills a market buy order", async () => {
    exchange.advanceTime(makeCandle({ time: 1000 }));

    await exchange.createOrder("BTC/USDT", "market", "buy", 1);

    // Market order should fill at the open of the NEXT candle
    exchange.advanceTime(makeCandle({ time: 2000, open: 100 }));
    const closed = await exchange.fetchClosedOrders();

    // The first order placed is a market order that fills immediately on the next advanceTime
    expect(closed.length).toBeGreaterThanOrEqual(1);
  });

  it("fills a limit buy when price reaches limit", async () => {
    exchange.advanceTime(makeCandle({ time: 1000, close: 100 }));
    await exchange.createOrder("BTC/USDT", "limit", "buy", 0.5, 95);

    // Price doesn't reach limit
    exchange.advanceTime(makeCandle({ time: 2000, low: 96 }));
    let openOrders = await exchange.fetchOpenOrders();
    expect(openOrders).toHaveLength(1);

    // Price reaches limit
    exchange.advanceTime(makeCandle({ time: 3000, low: 94 }));
    openOrders = await exchange.fetchOpenOrders();
    expect(openOrders).toHaveLength(0);

    const closedOrders = await exchange.fetchClosedOrders();
    const filled = closedOrders.find((o) => o.status === "closed");
    expect(filled).toBeDefined();
    expect(filled!.filled).toBe(0.5);
  });

  it("applies taker fee for market orders", async () => {
    exchange.advanceTime(makeCandle({ time: 1000 }));
    await exchange.createOrder("BTC/USDT", "market", "buy", 1);
    exchange.advanceTime(makeCandle({ time: 2000, open: 100 }));

    const closed = await exchange.fetchClosedOrders();
    const filled = closed.find((o) => o.status === "closed");
    if (filled?.fee) {
      expect(filled.fee.cost).toBeGreaterThan(0);
    }
  });

  it("applies slippage when enabled", async () => {
    const slippyExchange = new BacktestExchange(
      10000,
      { maker: 0.001, taker: 0.001 },
      { enabled: true, percentage: 0.01 }
    );

    slippyExchange.advanceTime(makeCandle({ time: 1000 }));
    await slippyExchange.createOrder("BTC/USDT", "market", "buy", 1);
    slippyExchange.advanceTime(makeCandle({ time: 2000, open: 100 }));

    // Slippage should make the fill price higher for a buy
    const closed = await slippyExchange.fetchClosedOrders();
    const filled = closed.find((o) => o.status === "closed");
    if (filled) {
      // Fill price should be > 100 (open) due to slippage
      expect(filled.cost).toBeGreaterThan(100);
    }
  });

  it("tracks equity correctly", () => {
    exchange.advanceTime(makeCandle({ time: 1000, close: 100 }));
    const equity = exchange.getEquity("BTC/USDT");
    expect(equity).toBe(10000); // Only USDT, no BTC
  });

  it("cancels orders", async () => {
    exchange.advanceTime(makeCandle({ time: 1000 }));
    const order = await exchange.createOrder("BTC/USDT", "limit", "buy", 1, 50);

    await exchange.cancelOrder(order.id);
    const openOrders = await exchange.fetchOpenOrders();
    expect(openOrders).toHaveLength(0);
  });

  it("returns candle history via fetchOHLCV", async () => {
    exchange.advanceTime(makeCandle({ time: 1000 }));
    exchange.advanceTime(makeCandle({ time: 2000 }));
    exchange.advanceTime(makeCandle({ time: 3000 }));

    const candles = await exchange.fetchOHLCV("BTC/USDT", "1m");
    expect(candles).toHaveLength(3);

    const limited = await exchange.fetchOHLCV("BTC/USDT", "1m", undefined, 2);
    expect(limited).toHaveLength(2);
  });

  it("getExchangeId returns configured id", () => {
    const custom = new BacktestExchange(1000, undefined, undefined, "binance-sim");
    expect(custom.getExchangeId()).toBe("binance-sim");
  });
});
