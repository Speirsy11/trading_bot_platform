import type { backtests } from "@tb/db";
import { describe, expect, it, vi } from "vitest";

import { createTrpcContext } from "../context";
import { createCaller } from "../router";

import { buildBacktestCompareRun } from "./backtest";

function createQueryBuilder<T>(rows: T[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    limit: () => builder,
    then: (resolve: (value: T[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };

  return builder;
}

describe("backtest router", () => {
  it("serializes compare runs with buy-and-hold benchmark evidence", () => {
    const row = {
      id: "0dccf49d-9071-435a-9188-0b6edb223c21",
      name: "SMA research replay",
      strategy: "sma-crossover",
      strategyParams: { fastPeriod: 50, slowPeriod: 200 },
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "15m",
      startTime: new Date("2026-01-01T00:00:00.000Z"),
      endTime: new Date("2026-02-01T00:00:00.000Z"),
      initialBalance: "10000",
      finalBalance: "11800",
      totalPnl: "1800",
      totalPnlPercent: "18",
      totalTrades: 42,
      winningTrades: 20,
      losingTrades: 22,
      winRate: "47.62",
      maxDrawdown: "12",
      sharpeRatio: "1.4",
      profitFactor: "1.2",
      metrics: {
        result: {
          equityCurve: [
            { time: Date.parse("2026-01-01T00:00:00.000Z"), equity: 10_000 },
            { time: Date.parse("2026-02-01T00:00:00.000Z"), equity: 11_800 },
          ],
          benchmark: {
            totalReturn: 10,
            finalBalance: 11_000,
            maxDrawdown: 8,
          },
          excessReturn: 8,
          drawdownAdvantage: -4,
        },
      },
      status: "completed",
      error: null,
      riskConfig: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      completedAt: new Date("2026-02-01T00:00:00.000Z"),
      deletedAt: null,
    } as typeof backtests.$inferSelect;

    expect(buildBacktestCompareRun(row)).toMatchObject({
      backtestId: row.id,
      name: "SMA research replay",
      symbol: "BTC/USDT",
      timeframe: "15m",
      totalReturn: 18,
      maxDrawdown: 12,
      benchmarkReturn: 10,
      benchmarkFinalBalance: 11_000,
      benchmarkMaxDrawdown: 8,
      excessReturn: 8,
      drawdownAdvantage: -4,
      equityCurve: [
        { t: "2026-01-01T00:00:00.000Z", balance: 10_000 },
        { t: "2026-02-01T00:00:00.000Z", balance: 11_800 },
      ],
    });
  });

  it("stores source research evidence when queueing a research replay backtest", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const insertedValues: unknown[] = [];
    const sourceResearch = "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f";
    const add = vi.fn().mockResolvedValue({ id: "job-1" });
    const publish = vi.fn().mockResolvedValue(1);
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: sourceResearch,
            strategy: "sma-crossover",
            strategyName: "SMA Crossover",
            strategyParams: { fastPeriod: 50, slowPeriod: 200 },
            paramHash: "abc123",
            timeframe: "15m",
            symbols: ["BTC/USDT", "ETH/USDT"],
            dataCoverage: [
              {
                symbol: "BTC/USDT",
                earliest: "2026-01-01T00:00:00.000Z",
                latest: "2026-02-01T00:00:00.000Z",
              },
              {
                symbol: "ETH/USDT",
                earliest: "2026-01-01T00:00:00.000Z",
                latest: "2026-02-01T00:00:00.000Z",
              },
            ],
            qualified: true,
            testMetrics: {
              benchmark: { totalReturn: 127.6 },
              excessReturn: -39.3,
            },
            outOfSampleReturn: "88.29",
            maxDrawdown: "18.82",
            sharpeRatio: "2.19",
            profitFactor: "1.34",
            totalTrades: "1281",
          },
        ])
      ),
      insert: vi.fn(() => ({
        values: vi.fn((values: unknown) => {
          insertedValues.push(values);
          return {
            returning: vi.fn().mockResolvedValue([
              {
                id: "0dccf49d-9071-435a-9188-0b6edb223c21",
              },
            ]),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => []),
        })),
      })),
      delete: vi.fn(),
    };

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: { publish } as never,
            queues: {
              backtestQueue: { add, getJob: vi.fn() },
            } as never,
            exchangeManager: {} as never,
            marketData: {} as never,
            keyVault: {} as never,
            exportsDir: "/tmp/exports",
          },
          {
            headers: {
              authorization: "Bearer test-token",
            },
          } as never
        )
      );

      const result = await caller.backtest.run({
        name: "SMA Crossover research replay",
        strategy: "sma-crossover",
        strategyParams: { fastPeriod: 50, slowPeriod: 200 },
        exchange: "binance",
        symbol: "BTC/USDT",
        timeframe: "15m",
        sourceResearch,
        startTime: Date.parse("2026-01-01T00:00:00.000Z"),
        endTime: Date.parse("2026-02-01T00:00:00.000Z"),
        initialBalance: 10_000,
        riskConfig: {
          maxPositionSizePercent: 10,
          maxDrawdownPercent: 20,
          riskPerTradePercent: 2,
          maxConcurrentPositions: 5,
          maxDailyLossPercent: 5,
          trailingStopEnabled: false,
          trailingStopPercent: 5,
        },
        fees: { maker: 0.001, taker: 0.001 },
        slippage: { enabled: true, percentage: 0.0005 },
      });

      expect(result.backtestId).toBe("0dccf49d-9071-435a-9188-0b6edb223c21");
      expect(insertedValues[0]).toMatchObject({
        metrics: {
          fees: { maker: 0.001, taker: 0.001 },
          slippage: { enabled: true, percentage: 0.0005 },
          sourceEvidence: {
            sourceType: "research",
            sourceId: sourceResearch,
            sourceLabel: "SMA Crossover · 15m",
            benchmarkStatus: "profit-only",
            qualified: true,
            paperBotEligible: false,
            outOfSampleReturn: 88.29,
            benchmarkReturn: 127.6,
            excessReturn: -39.3,
            initialBalance: 10_000,
            fees: { maker: 0.001, taker: 0.001 },
            slippage: { enabled: true, percentage: 0.0005 },
          },
        },
      });
      expect(add).toHaveBeenCalledWith(
        "run-backtest",
        { backtestId: "0dccf49d-9071-435a-9188-0b6edb223c21" },
        expect.objectContaining({ jobId: "backtest-0dccf49d-9071-435a-9188-0b6edb223c21" })
      );
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects research provenance when the replay date window drifts from source coverage", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const sourceResearch = "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f";
    const insert = vi.fn();
    const add = vi.fn();
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: sourceResearch,
            strategy: "sma-crossover",
            strategyName: "SMA Crossover",
            strategyParams: { fastPeriod: 50, slowPeriod: 200 },
            paramHash: "abc123",
            timeframe: "15m",
            symbols: ["BTC/USDT"],
            dataCoverage: [
              {
                symbol: "BTC/USDT",
                earliest: "2026-01-01T00:00:00.000Z",
                latest: "2026-02-01T00:00:00.000Z",
              },
            ],
            qualified: true,
            testMetrics: {},
          },
        ])
      ),
      insert,
    };

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: { publish: vi.fn() } as never,
            queues: {
              backtestQueue: { add, getJob: vi.fn() },
            } as never,
            exchangeManager: {} as never,
            marketData: {} as never,
            keyVault: {} as never,
            exportsDir: "/tmp/exports",
          },
          {
            headers: {
              authorization: "Bearer test-token",
            },
          } as never
        )
      );

      await expect(
        caller.backtest.run({
          name: "Window-drift research replay",
          strategy: "sma-crossover",
          strategyParams: { fastPeriod: 50, slowPeriod: 200 },
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "15m",
          sourceResearch,
          startTime: Date.parse("2026-01-02T00:00:00.000Z"),
          endTime: Date.parse("2026-02-01T00:00:00.000Z"),
          initialBalance: 10_000,
          riskConfig: {
            maxPositionSizePercent: 10,
            maxDrawdownPercent: 20,
            riskPerTradePercent: 2,
            maxConcurrentPositions: 5,
            maxDailyLossPercent: 5,
            trailingStopEnabled: false,
            trailingStopPercent: 5,
          },
          fees: { maker: 0.001, taker: 0.001 },
          slippage: { enabled: true, percentage: 0.0005 },
        })
      ).rejects.toThrow(/replay time window does not match/);

      expect(insert).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects unqualified research results as manual replay evidence", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const sourceResearch = "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f";
    const insert = vi.fn();
    const add = vi.fn();
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: sourceResearch,
            strategy: "sma-crossover",
            strategyName: "SMA Crossover",
            strategyParams: { fastPeriod: 50, slowPeriod: 200 },
            paramHash: "abc123",
            timeframe: "15m",
            symbols: ["BTC/USDT"],
            dataCoverage: [
              {
                symbol: "BTC/USDT",
                earliest: "2026-01-01T00:00:00.000Z",
                latest: "2026-02-01T00:00:00.000Z",
              },
            ],
            qualified: false,
            testMetrics: {},
          },
        ])
      ),
      insert,
    };

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: { publish: vi.fn() } as never,
            queues: {
              backtestQueue: { add, getJob: vi.fn() },
            } as never,
            exchangeManager: {} as never,
            marketData: {} as never,
            keyVault: {} as never,
            exportsDir: "/tmp/exports",
          },
          {
            headers: {
              authorization: "Bearer test-token",
            },
          } as never
        )
      );

      await expect(
        caller.backtest.run({
          name: "Unqualified research replay",
          strategy: "sma-crossover",
          strategyParams: { fastPeriod: 50, slowPeriod: 200 },
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "15m",
          sourceResearch,
          startTime: Date.parse("2026-01-01T00:00:00.000Z"),
          endTime: Date.parse("2026-02-01T00:00:00.000Z"),
          initialBalance: 10_000,
          riskConfig: {
            maxPositionSizePercent: 10,
            maxDrawdownPercent: 20,
            riskPerTradePercent: 2,
            maxConcurrentPositions: 5,
            maxDailyLossPercent: 5,
            trailingStopEnabled: false,
            trailingStopPercent: 5,
          },
          fees: { maker: 0.001, taker: 0.001 },
          slippage: { enabled: true, percentage: 0.0005 },
        })
      ).rejects.toThrow(/Only historically profitable research results/);

      expect(insert).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects research provenance when replay execution assumptions drift", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const sourceResearch = "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f";
    const insert = vi.fn();
    const add = vi.fn();
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: sourceResearch,
            strategy: "sma-crossover",
            strategyName: "SMA Crossover",
            strategyParams: { fastPeriod: 50, slowPeriod: 200 },
            paramHash: "abc123",
            timeframe: "15m",
            symbols: ["BTC/USDT"],
            dataCoverage: [
              {
                symbol: "BTC/USDT",
                earliest: "2026-01-01T00:00:00.000Z",
                latest: "2026-02-01T00:00:00.000Z",
              },
            ],
            qualified: true,
            testMetrics: {},
          },
        ])
      ),
      insert,
    };

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: { publish: vi.fn() } as never,
            queues: {
              backtestQueue: { add, getJob: vi.fn() },
            } as never,
            exchangeManager: {} as never,
            marketData: {} as never,
            keyVault: {} as never,
            exportsDir: "/tmp/exports",
          },
          {
            headers: {
              authorization: "Bearer test-token",
            },
          } as never
        )
      );

      await expect(
        caller.backtest.run({
          name: "Assumption-drift research replay",
          strategy: "sma-crossover",
          strategyParams: { fastPeriod: 50, slowPeriod: 200 },
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "15m",
          sourceResearch,
          startTime: Date.parse("2026-01-01T00:00:00.000Z"),
          endTime: Date.parse("2026-02-01T00:00:00.000Z"),
          initialBalance: 20_000,
          riskConfig: {
            maxPositionSizePercent: 10,
            maxDrawdownPercent: 20,
            riskPerTradePercent: 2,
            maxConcurrentPositions: 5,
            maxDailyLossPercent: 5,
            trailingStopEnabled: false,
            trailingStopPercent: 5,
          },
          fees: { maker: 0, taker: 0 },
          slippage: { enabled: false, percentage: 0 },
        })
      ).rejects.toThrow(/execution assumptions do not match/);

      expect(insert).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects research provenance when the replay config drifts from the source result", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const sourceResearch = "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f";
    const insert = vi.fn();
    const add = vi.fn();
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: sourceResearch,
            strategy: "sma-crossover",
            strategyName: "SMA Crossover",
            strategyParams: { fastPeriod: 50, slowPeriod: 200 },
            paramHash: "abc123",
            timeframe: "15m",
            symbols: ["BTC/USDT"],
            qualified: true,
            testMetrics: {},
          },
        ])
      ),
      insert,
    };

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: { publish: vi.fn() } as never,
            queues: {
              backtestQueue: { add, getJob: vi.fn() },
            } as never,
            exchangeManager: {} as never,
            marketData: {} as never,
            keyVault: {} as never,
            exportsDir: "/tmp/exports",
          },
          {
            headers: {
              authorization: "Bearer test-token",
            },
          } as never
        )
      );

      await expect(
        caller.backtest.run({
          name: "Tampered research replay",
          strategy: "sma-crossover",
          strategyParams: { fastPeriod: 20, slowPeriod: 50 },
          exchange: "binance",
          symbol: "SOL/USDT",
          timeframe: "1h",
          sourceResearch,
          startTime: Date.parse("2026-01-01T00:00:00.000Z"),
          endTime: Date.parse("2026-02-01T00:00:00.000Z"),
          initialBalance: 10_000,
          riskConfig: {
            maxPositionSizePercent: 10,
            maxDrawdownPercent: 20,
            riskPerTradePercent: 2,
            maxConcurrentPositions: 5,
            maxDailyLossPercent: 5,
            trailingStopEnabled: false,
            trailingStopPercent: 5,
          },
          fees: { maker: 0.001, taker: 0.001 },
          slippage: { enabled: true, percentage: 0.0005 },
        })
      ).rejects.toThrow(/exact research replays/);

      expect(insert).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });
});
