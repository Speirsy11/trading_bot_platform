import { describe, expect, it } from "vitest";

import { createTrpcContext } from "../context";
import { createCaller } from "../router";

function createQueryBuilder<T>(rows: T[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    then: (resolve: (value: T[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return builder;
}

function caller(rows: unknown[]) {
  const db = { select: () => createQueryBuilder(rows) };
  return createCaller(
    createTrpcContext({
      db: db as never,
      redis: {} as never,
      queues: {} as never,
      exchangeManager: {} as never,
      marketData: {} as never,
      keyVault: {} as never,
      exportsDir: "/tmp/exports",
    })
  );
}

describe("portfolio router", () => {
  it("getSummary aggregates balances, pnl, and bot counts", async () => {
    const result = await caller([
      { currentBalance: "1000", totalPnl: "100", status: "running", exchange: "binance" },
      { currentBalance: "500", totalPnl: "-50", status: "stopped", exchange: "binance" },
    ]).portfolio.getSummary();

    expect(result.totalValue).toBe(1500);
    expect(result.totalPnl).toBe(50);
    expect(result.botCount).toBe(2);
    expect(result.runningBots).toBe(1);
    expect(result.totalPnlPercent).toBeCloseTo((50 / 1450) * 100);
  });

  it("getPositions nets buys against sells per symbol", async () => {
    const result = await caller([
      {
        symbol: "BTC/USDT",
        side: "buy",
        amount: "1",
        cost: "100",
        pnl: "0",
        executedAt: new Date("2024-01-02T00:00:00.000Z"),
      },
      {
        symbol: "BTC/USDT",
        side: "sell",
        amount: "0.5",
        cost: "60",
        pnl: "10",
        executedAt: new Date("2024-01-03T00:00:00.000Z"),
      },
    ]).portfolio.getPositions();

    expect(result).toEqual([
      {
        symbol: "BTC/USDT",
        quantity: 0.5,
        averagePrice: 80,
        realisedPnl: 10,
        lastTradeAt: "2024-01-03T00:00:00.000Z",
      },
    ]);
  });

  it("getEquityCurve returns a cumulative pnl curve", async () => {
    const result = await caller([
      { pnl: "10", executedAt: new Date("2024-01-01T00:00:00.000Z") },
      { pnl: "5", executedAt: new Date("2024-01-02T00:00:00.000Z") },
    ]).portfolio.getEquityCurve({ period: "all" });

    expect(result.map((point) => point.equity)).toEqual([10, 15]);
  });

  it("getAllocation reports per-exchange balance percentages", async () => {
    const result = await caller([
      { exchange: "binance", currentBalance: "1000" },
      { exchange: "kraken", currentBalance: "1000" },
    ]).portfolio.getAllocation();

    expect(result).toEqual([
      { exchange: "binance", value: 1000, percentage: 50 },
      { exchange: "kraken", value: 1000, percentage: 50 },
    ]);
  });

  it("getSummary handles an empty portfolio without dividing by zero", async () => {
    const result = await caller([]).portfolio.getSummary();
    expect(result).toMatchObject({ totalValue: 0, totalPnl: 0, totalPnlPercent: 0, botCount: 0 });
  });
});
