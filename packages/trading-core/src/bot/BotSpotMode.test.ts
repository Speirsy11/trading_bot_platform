import type { Candle, Order, OrderSide, OrderType, Balance } from "@tb/types";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { IExchange, OrderBook, Ticker } from "../exchange/types";
import type { IStrategy, Signal } from "../strategy/IStrategy";
import type { StrategyContext } from "../strategy/StrategyContext";

import { Bot, type BotConfig, type BotOrderFill } from "./Bot";

class SellFirstStrategy implements IStrategy {
  readonly name = "Sell First";
  readonly description = "Attempts to sell before any spot inventory exists";
  readonly paramsSchema = z.object({});
  private ctx!: StrategyContext;
  private emitted = false;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
  }

  async onCandle(): Promise<Signal[]> {
    if (this.emitted) return [];
    this.emitted = true;
    return [
      {
        action: "SELL",
        symbol: this.ctx.config.symbol,
        orderType: "market",
        reason: "short attempt",
      },
    ];
  }

  async cleanup(): Promise<void> {}
}

class BuyThenSellStrategy implements IStrategy {
  readonly name = "Buy Then Sell";
  readonly description = "Buys with available quote, then emits a generic sell signal";
  readonly paramsSchema = z.object({});
  private ctx!: StrategyContext;
  private index = 0;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
  }

  async onCandle(): Promise<Signal[]> {
    this.index += 1;
    if (this.index === 1) {
      return [
        {
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: "enter spot",
        },
      ];
    }
    if (this.index === 2) {
      return [
        {
          action: "SELL",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: "generic exit",
        },
      ];
    }
    return [];
  }

  async cleanup(): Promise<void> {}
}

describe("Bot spot market mode", () => {
  it("does not let SELL open a short position", async () => {
    const exchange = new RecordingSpotExchange();
    const bot = createBot(new SellFirstStrategy(), exchange);

    await bot.start();
    await bot.processCandle(candle(1, 100));

    expect(exchange.createOrder).not.toHaveBeenCalled();
    expect(await exchange.fetchBalance()).toMatchObject({
      free: { USDT: 10_000 },
      total: { USDT: 10_000 },
    });
  });

  it("uses available quote for spot BUY and closes existing inventory on SELL", async () => {
    const exchange = new RecordingSpotExchange();
    const bot = createBot(new BuyThenSellStrategy(), exchange);

    await bot.start();
    await bot.processCandle(candle(1, 100));
    await bot.processCandle(candle(2, 105));

    expect(exchange.orders).toHaveLength(2);
    const [buy, sell] = exchange.orders;
    const expectedAmount = 10_000 / (100 * 1.0005 * 1.001);

    expect(buy).toMatchObject({ side: "buy", symbol: "BTC/USDT" });
    expect(buy?.amount).toBeCloseTo(expectedAmount, 8);
    expect(sell).toMatchObject({ side: "sell", symbol: "BTC/USDT" });
    expect(sell?.amount).toBeCloseTo(expectedAmount, 8);
  });

  it("emits an audit event for each closed order with realised trade details on exit", async () => {
    const exchange = new RecordingSpotExchange();
    const fills: BotOrderFill[] = [];
    const onOrderFilled = vi.fn((fill: BotOrderFill) => {
      fills.push(fill);
    });
    const bot = createBot(new BuyThenSellStrategy(), exchange, { onOrderFilled });

    await bot.start();
    await bot.processCandle(candle(1, 100));
    await bot.processCandle(candle(2, 105));

    expect(onOrderFilled).toHaveBeenCalledTimes(2);
    const [entry, exit] = fills;
    expect(entry).toBeDefined();
    expect(exit).toBeDefined();
    if (!entry || !exit) throw new Error("Expected entry and exit fills");

    expect(entry).toMatchObject({
      reason: "enter spot",
      order: { side: "buy", status: "closed" },
      trade: null,
      candle: { time: 1 },
    });
    expect(exit.order).toMatchObject({ side: "sell", status: "closed" });
    expect(exit.trade).toMatchObject({
      orderId: exit.order.id,
      symbol: "BTC/USDT",
      side: "sell",
    });
    expect(exit.trade?.pnl).toBeLessThan(0);
  });
});

function createBot(strategy: IStrategy, exchange: IExchange, overrides: Partial<BotConfig> = {}) {
  return new Bot(
    {
      id: "test-bot",
      name: "Test Bot",
      symbol: "BTC/USDT",
      timeframe: "1h",
      strategyParams: {},
      marketMode: "spot",
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: true, percentage: 0.0005 },
      riskConfig: {
        maxPositionSizePercent: 1,
        maxDrawdownPercent: 20,
        riskPerTradePercent: 1,
        maxConcurrentPositions: 1,
        maxDailyLossPercent: 5,
        trailingStopEnabled: false,
        trailingStopPercent: 5,
      },
      ...overrides,
    },
    strategy,
    exchange,
    {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    }
  );
}

function candle(time: number, close: number): Candle {
  return {
    time,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  };
}

class RecordingSpotExchange implements IExchange {
  orders: Order[] = [];
  private balance: Balance = {
    total: { USDT: 10_000 },
    free: { USDT: 10_000 },
    used: {},
  };

  createOrder = vi.fn(
    async (
      symbol: string,
      type: OrderType,
      side: OrderSide,
      amount: number,
      price?: number
    ): Promise<Order> => {
      const [base, quote] = symbol.split("/") as [string, string];
      const fillPrice = price ?? 100;
      const cost = amount * fillPrice;
      const fee = cost * 0.001;

      if (side === "buy") {
        if ((this.balance.free[quote] ?? 0) < cost + fee) {
          throw new Error(`Insufficient ${quote} balance`);
        }
        this.balance.free[quote] = (this.balance.free[quote] ?? 0) - cost - fee;
        this.balance.total[quote] = this.balance.free[quote] ?? 0;
        this.balance.free[base] = (this.balance.free[base] ?? 0) + amount;
        this.balance.total[base] = this.balance.free[base] ?? 0;
      } else {
        if ((this.balance.free[base] ?? 0) < amount) {
          throw new Error(`Insufficient ${base} balance`);
        }
        this.balance.free[base] = (this.balance.free[base] ?? 0) - amount;
        this.balance.total[base] = this.balance.free[base] ?? 0;
        this.balance.free[quote] = (this.balance.free[quote] ?? 0) + cost - fee;
        this.balance.total[quote] = this.balance.free[quote] ?? 0;
      }

      const order: Order = {
        id: `order-${this.orders.length + 1}`,
        symbol,
        type,
        side,
        amount,
        price: fillPrice,
        filled: amount,
        remaining: 0,
        cost,
        status: "closed",
        timestamp: Date.now(),
        fee: { cost: fee, currency: quote },
      };
      this.orders.push(order);
      return order;
    }
  );

  async fetchOHLCV(): Promise<Candle[]> {
    return [];
  }

  async fetchTicker(): Promise<Ticker> {
    return {
      symbol: "BTC/USDT",
      last: 100,
      bid: 99,
      ask: 101,
      high: 100,
      low: 100,
      volume: 1,
      timestamp: Date.now(),
    };
  }

  async fetchOrderBook(): Promise<OrderBook> {
    return { bids: [], asks: [], timestamp: Date.now() };
  }

  async fetchBalance(): Promise<Balance> {
    return {
      total: { ...this.balance.total },
      free: { ...this.balance.free },
      used: { ...this.balance.used },
    };
  }

  async fetchOpenOrders(): Promise<Order[]> {
    return [];
  }

  async fetchClosedOrders(): Promise<Order[]> {
    return [...this.orders];
  }

  async cancelOrder(): Promise<void> {}

  getExchangeId(): string {
    return "recording";
  }
}
