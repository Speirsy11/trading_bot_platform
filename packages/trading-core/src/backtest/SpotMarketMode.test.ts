import type { Candle } from "@tb/types";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { IStrategy, Signal } from "../strategy/IStrategy";
import type { StrategyContext } from "../strategy/StrategyContext";

import type { BacktestConfig } from "./BacktestConfig";
import { BacktestEngine } from "./BacktestEngine";

class SellFirstStrategy implements IStrategy {
  readonly name = "Sell First";
  readonly description = "Attempts to sell before owning spot inventory";
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

class BuyOnceStrategy implements IStrategy {
  readonly name = "Buy Once";
  readonly description = "Buys spot inventory with available quote";
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
        action: "BUY",
        symbol: this.ctx.config.symbol,
        orderType: "market",
        reason: "enter spot",
      },
    ];
  }

  async cleanup(): Promise<void> {}
}

class BuyThenSellStrategy implements IStrategy {
  readonly name = "Buy Then Sell";
  readonly description = "Buys spot inventory and exits on the next candle";
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
          reason: "exit spot",
        },
      ];
    }
    return [];
  }

  async cleanup(): Promise<void> {}
}

describe("BacktestEngine spot market mode", () => {
  it("does not let SELL open a short position", async () => {
    const candles: Candle[] = Array.from({ length: 120 }, (_, index) => ({
      time: Date.UTC(2026, 0, 1, 0, index),
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1,
    }));
    const config: BacktestConfig = {
      strategyName: "sell-first",
      strategyParams: {},
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "1m",
      startDate: candles[0]!.time,
      endDate: candles[candles.length - 1]!.time,
      initialBalance: 10_000,
      marketMode: "spot",
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: true, percentage: 0.0005 },
      riskConfig: {
        maxPositionSizePercent: 10,
        maxDrawdownPercent: 20,
        riskPerTradePercent: 2,
        maxConcurrentPositions: 1,
        maxDailyLossPercent: 5,
        trailingStopEnabled: false,
        trailingStopPercent: 5,
      },
    };

    const result = await new BacktestEngine(config).run(candles, new SellFirstStrategy());

    expect(result.trades).toHaveLength(0);
    expect(result.orderFills).toHaveLength(0);
    expect(result.finalBalance).toBe(10_000);
    expect(result.metrics.totalTrades).toBe(0);
  });

  it("uses available quote balance for spot BUY signals without opening leverage", async () => {
    const candles: Candle[] = Array.from({ length: 24 }, (_, index) => {
      const close = 100 + index;
      return {
        time: Date.UTC(2026, 0, 1, index),
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1,
      };
    });
    const config: BacktestConfig = {
      strategyName: "buy-once",
      strategyParams: {},
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "1h",
      startDate: candles[0]!.time,
      endDate: candles[candles.length - 1]!.time,
      initialBalance: 10_000,
      marketMode: "spot",
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: true, percentage: 0.0005 },
      riskConfig: {
        maxPositionSizePercent: 10,
        maxDrawdownPercent: 20,
        riskPerTradePercent: 2,
        maxConcurrentPositions: 1,
        maxDailyLossPercent: 5,
        trailingStopEnabled: false,
        trailingStopPercent: 5,
      },
    };

    const result = await new BacktestEngine(config).run(candles, new BuyOnceStrategy());

    expect(result.finalBalance).toBeGreaterThan(12_000);
    expect(result.finalBalance).toBeLessThan(12_300);
    expect(result.metrics.totalReturn).toBeGreaterThan(20);
    expect(result.orderFills).toEqual([
      expect.objectContaining({
        side: "buy",
        symbol: "BTC/USDT",
        timestamp: candles[0]!.time,
      }),
    ]);
  });

  it("defaults omitted market mode to spot semantics", async () => {
    const candles: Candle[] = Array.from({ length: 24 }, (_, index) => {
      const close = 100 + index;
      return {
        time: Date.UTC(2026, 0, 2, index),
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1,
      };
    });
    const config: BacktestConfig = {
      strategyName: "buy-once-default-spot",
      strategyParams: {},
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "1h",
      startDate: candles[0]!.time,
      endDate: candles[candles.length - 1]!.time,
      initialBalance: 10_000,
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: true, percentage: 0.0005 },
      riskConfig: {
        maxPositionSizePercent: 10,
        maxDrawdownPercent: 20,
        riskPerTradePercent: 2,
        maxConcurrentPositions: 1,
        maxDailyLossPercent: 5,
        trailingStopEnabled: false,
        trailingStopPercent: 5,
      },
    };

    const result = await new BacktestEngine(config).run(candles, new BuyOnceStrategy());

    expect(result.orderFills).toHaveLength(1);
    expect(result.finalBalance).toBeGreaterThan(12_000);
    expect(result.finalBalance).toBeLessThan(12_300);
  });

  it("does not double-count immediate market fills before the next candle", async () => {
    const candles: Candle[] = Array.from({ length: 6 }, (_, index) => {
      const close = index === 0 ? 100 : 110;
      return {
        time: Date.UTC(2026, 0, 1, index),
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1,
      };
    });
    const config: BacktestConfig = {
      strategyName: "buy-then-sell",
      strategyParams: {},
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "1h",
      startDate: candles[0]!.time,
      endDate: candles[candles.length - 1]!.time,
      initialBalance: 10_000,
      marketMode: "spot",
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: true, percentage: 0.0005 },
      riskConfig: {
        maxPositionSizePercent: 10,
        maxDrawdownPercent: 20,
        riskPerTradePercent: 2,
        maxConcurrentPositions: 1,
        maxDailyLossPercent: 5,
        trailingStopEnabled: false,
        trailingStopPercent: 5,
      },
    };

    const result = await new BacktestEngine(config).run(candles, new BuyThenSellStrategy());

    expect(result.orderFills).toHaveLength(2);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      symbol: "BTC/USDT",
      side: "sell",
      reason: "exit spot",
    });
    expect(result.metrics.totalTrades).toBe(1);
    expect(result.finalBalance).toBeGreaterThan(10_800);
  });
});
