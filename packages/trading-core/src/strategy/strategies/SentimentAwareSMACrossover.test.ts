import { IndicatorCalculator } from "@tb/indicators";
import type { Candle } from "@tb/types";
import { describe, expect, it } from "vitest";

import { InMemoryStrategyContextProvider } from "../../context/types";
import { BacktestExchange } from "../../exchange/BacktestExchange";
import { PositionManager } from "../../orders/PositionManager";
import { StrategyContext } from "../StrategyContext";

import { SentimentAwareSMACrossover } from "./SentimentAwareSMACrossover";

function candle(index: number, close: number): Candle {
  return {
    time: Date.UTC(2026, 0, 1, 0, index),
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
  };
}

async function makeStrategy(score: number) {
  const strategy = new SentimentAwareSMACrossover();
  const ctx = new StrategyContext(
    new BacktestExchange(10_000, 0, 0, "binance"),
    {
      symbol: "BTC/USDT",
      timeframe: "1m",
      strategyParams: { fastPeriod: 2, slowPeriod: 5, minBuySentiment: -0.1 },
    },
    new IndicatorCalculator(),
    new PositionManager(),
    undefined,
    new InMemoryStrategyContextProvider([
      {
        id: "evt-1",
        source: "test",
        kind: "news_sentiment",
        asset: "BTC",
        symbol: "BTC/USDT",
        publishedAt: new Date(Date.UTC(2026, 0, 1, 0, 6)).toISOString(),
        score,
      },
    ])
  );
  await strategy.initialize(ctx);
  return strategy;
}

async function run(strategy: SentimentAwareSMACrossover, closes: number[]) {
  const history: Candle[] = [];
  const allSignals = [];
  for (let i = 0; i < closes.length; i++) {
    history.push(candle(i, closes[i]!));
    allSignals.push(...(await strategy.onCandle(history.at(-1)!, [...history])));
  }
  return allSignals;
}

describe("SentimentAwareSMACrossover", () => {
  it("blocks buy signals when recent sentiment is too negative", async () => {
    const strategy = await makeStrategy(-0.8);
    const signals = await run(strategy, [10, 10, 10, 10, 9, 9, 12]);
    expect(signals.some((signal) => signal.action === "BUY")).toBe(false);
  });

  it("allows buy signals when recent sentiment is supportive", async () => {
    const strategy = await makeStrategy(0.4);
    const signals = await run(strategy, [10, 10, 10, 10, 9, 9, 12]);
    expect(signals.some((signal) => signal.action === "BUY")).toBe(true);
  });
});
