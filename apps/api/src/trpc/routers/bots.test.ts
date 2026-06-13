import { describe, expect, it, vi } from "vitest";

import { createTrpcContext } from "../context";
import { createCaller } from "../router";

function createQueryBuilder<T>(rows: T[]) {
  const state = {
    offset: 0,
    limit: undefined as number | undefined,
  };

  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    groupBy: () => builder,
    limit: (value: number) => {
      state.limit = value;
      return builder;
    },
    offset: (value: number) => {
      state.offset = value;
      return builder;
    },
    then: (resolve: (value: T[]) => unknown, reject?: (reason: unknown) => unknown) => {
      const start = state.offset;
      const end = state.limit == null ? undefined : start + state.limit;
      return Promise.resolve(rows.slice(start, end)).then(resolve, reject);
    },
  };

  return builder;
}

function createDbMock(selectRows: unknown[][]) {
  const select = vi.fn(() => createQueryBuilder(selectRows.shift() ?? []));
  const returning = vi.fn().mockResolvedValue([{}]);
  const updateWhere = vi.fn(() => ({ returning }));

  return {
    select,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: updateWhere,
      })),
    })),
  };
}

function createBotControlDb(row: Record<string, unknown>) {
  const updates: Array<Record<string, unknown>> = [];
  const select = vi.fn(() => createQueryBuilder([row]));

  const update = vi.fn(() => ({
    set: vi.fn((values: Record<string, unknown>) => {
      updates.push(values);
      return {
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{}]),
        })),
      };
    }),
  }));

  return { db: { select, update }, updates };
}

function botControlRow(status: string, extra: Record<string, unknown> = {}) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e",
    name: "Momentum Bot",
    strategy: "sma-crossover",
    strategyParams: {},
    exchange: "binance",
    symbol: "BTC/USDT",
    timeframe: "1h",
    mode: "paper",
    status,
    riskConfig: {},
    promotionEvidence: {},
    currentBalance: "10000",
    totalPnl: "0",
    totalTrades: "0",
    winRate: "0",
    errorMessage: null,
    startedAt: null,
    stoppedAt: null,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

describe("bots router", () => {
  it("stores promotion evidence when creating a historically profitable research paper bot", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const insertedValues: unknown[] = [];
    const sourceId = "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f";
    const sourceSweepId = "c754aa45-64a2-446c-a0cf-e4f76236c201";
    const executionAssumptions = {
      marketMode: "spot",
      initialBalance: 25_000,
      fees: { maker: 0.0008, taker: 0.0012 },
      slippage: { enabled: true, percentage: 0.0007 },
    };
    const promotionEvidence = {
      sourceType: "research" as const,
      sourceId,
    };
    const expectedPromotionEvidence = {
      sourceType: "research" as const,
      sourceId,
      sourceSweepId,
      sourceLabel: "SMA Crossover · 1h",
      benchmarkStatus: "profit-only",
      alphaQualified: false,
      paperBotEligible: true,
      executionAssumptions,
      outOfSampleReturn: 12.5,
      benchmarkReturn: 9.1,
      excessReturn: -3.2,
      maxDrawdown: 9.4,
      sharpeRatio: 1.7,
      profitFactor: 1.3,
      totalTrades: 42,
    };
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: sourceId,
            sweepId: sourceSweepId,
            strategy: "sma-crossover",
            strategyName: "SMA Crossover",
            strategyParams: { fastPeriod: 9, slowPeriod: 21 },
            timeframe: "1h",
            marketMode: "spot",
            symbols: ["BTC/USDT", "ETH/USDT"],
            qualified: true,
            testMetrics: {
              benchmark: { totalReturn: 9.1 },
              excessReturn: -3.2,
              executionAssumptions,
            },
            outOfSampleReturn: "12.5",
            maxDrawdown: "9.4",
            sharpeRatio: "1.7",
            profitFactor: "1.3",
            totalTrades: "42",
          },
        ])
      ),
      insert: vi.fn(() => ({
        values: vi.fn((values: unknown) => {
          insertedValues.push(values);
          const inserted = values as { promotionEvidence?: unknown };
          return {
            returning: vi.fn().mockResolvedValue([
              {
                id: "0dccf49d-9071-435a-9188-0b6edb223c21",
                name: "Research Paper Bot",
                strategy: "sma-crossover",
                strategyParams: { fastPeriod: 9, slowPeriod: 21 },
                exchange: "binance",
                symbol: "BTC/USDT",
                timeframe: "1h",
                mode: "paper",
                status: "idle",
                riskConfig: {},
                promotionEvidence: inserted.promotionEvidence,
                currentBalance: "10000",
                totalPnl: "0",
                totalTrades: "0",
                winRate: "0",
                errorMessage: null,
                startedAt: null,
                stoppedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          };
        }),
      })),
    };

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: {} as never,
            queues: {} as never,
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

      const result = await caller.bots.create({
        name: "Research Paper Bot",
        strategy: "sma-crossover",
        strategyParams: { fastPeriod: 9, slowPeriod: 21 },
        exchange: "binance",
        symbol: "BTC/USDT",
        timeframe: "1h",
        mode: "paper",
        riskConfig: {
          maxPositionSizePercent: 10,
          maxDrawdownPercent: 20,
          riskPerTradePercent: 2,
          maxConcurrentPositions: 5,
          maxDailyLossPercent: 5,
          trailingStopEnabled: false,
          trailingStopPercent: 5,
        },
        currentBalance: 10000,
        promotionEvidence,
      });

      expect(insertedValues[0]).toMatchObject({
        currentBalance: "25000",
        promotionEvidence: {
          ...expectedPromotionEvidence,
          verifiedAt: expect.any(Number),
        },
      });
      expect(result.promotionEvidence).toMatchObject({
        ...expectedPromotionEvidence,
        verifiedAt: expect.any(Number),
      });
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects research promotion evidence when bot config no longer matches the source", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const insert = vi.fn();
    const sourceId = "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f";
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: sourceId,
            strategy: "sma-crossover",
            strategyName: "SMA Crossover",
            strategyParams: { fastPeriod: 9, slowPeriod: 21 },
            timeframe: "1h",
            symbols: ["BTC/USDT"],
            qualified: true,
            testMetrics: { excessReturn: 5 },
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
            redis: {} as never,
            queues: {} as never,
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
        caller.bots.create({
          name: "Tampered Research Paper Bot",
          strategy: "sma-crossover",
          strategyParams: { fastPeriod: 50, slowPeriod: 200 },
          exchange: "binance",
          symbol: "SOL/USDT",
          timeframe: "4h",
          mode: "paper",
          riskConfig: {
            maxPositionSizePercent: 10,
            maxDrawdownPercent: 20,
            riskPerTradePercent: 2,
            maxConcurrentPositions: 5,
            maxDailyLossPercent: 5,
            trailingStopEnabled: false,
            trailingStopPercent: 5,
          },
          currentBalance: 10000,
          promotionEvidence: {
            sourceType: "research",
            sourceId,
          },
        })
      ).rejects.toThrow(/exact research replays/);

      expect(insert).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("stores benchmark evidence when creating a paper bot from a completed backtest", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const insertedValues: unknown[] = [];
    const sourceId = "2f297746-8cd2-47d1-8b3e-198489bb8e78";
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: sourceId,
            name: "Benchmark Evidence Backtest",
            strategy: "sma-crossover",
            strategyParams: { fastPeriod: 50, slowPeriod: 200 },
            exchange: "binance",
            symbol: "BTC/USDT",
            timeframe: "15m",
            status: "completed",
            metrics: {
              fees: { maker: 0.0009, taker: 0.0011 },
              slippage: { enabled: true, percentage: 0.0006 },
              result: {
                benchmark: { totalReturn: 12.4 },
                excessReturn: 6.4,
              },
            },
            totalPnlPercent: "18.8",
            maxDrawdown: "11.7",
            sharpeRatio: "1.42",
            profitFactor: "1.31",
            totalTrades: 42,
            deletedAt: null,
          },
        ])
      ),
      insert: vi.fn(() => ({
        values: vi.fn((values: unknown) => {
          insertedValues.push(values);
          const inserted = values as { promotionEvidence?: unknown };
          return {
            returning: vi.fn().mockResolvedValue([
              {
                id: "0dccf49d-9071-435a-9188-0b6edb223c21",
                name: "Backtest Paper Bot",
                strategy: "sma-crossover",
                strategyParams: { fastPeriod: 50, slowPeriod: 200 },
                exchange: "binance",
                symbol: "BTC/USDT",
                timeframe: "15m",
                mode: "paper",
                status: "idle",
                riskConfig: {},
                promotionEvidence: inserted.promotionEvidence,
                currentBalance: "10000",
                totalPnl: "0",
                totalTrades: "0",
                winRate: "0",
                errorMessage: null,
                startedAt: null,
                stoppedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          };
        }),
      })),
    };

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: {} as never,
            queues: {} as never,
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

      await caller.bots.create({
        name: "Backtest Paper Bot",
        strategy: "sma-crossover",
        strategyParams: { fastPeriod: 50, slowPeriod: 200 },
        exchange: "binance",
        symbol: "BTC/USDT",
        timeframe: "15m",
        mode: "paper",
        riskConfig: {
          maxPositionSizePercent: 10,
          maxDrawdownPercent: 20,
          riskPerTradePercent: 2,
          maxConcurrentPositions: 5,
          maxDailyLossPercent: 5,
          trailingStopEnabled: false,
          trailingStopPercent: 5,
        },
        currentBalance: 10000,
        promotionEvidence: {
          sourceType: "backtest",
          sourceId,
        },
      });

      expect(insertedValues[0]).toMatchObject({
        promotionEvidence: {
          sourceType: "backtest",
          sourceId,
          sourceLabel: "sma-crossover · BTC/USDT · 15m",
          benchmarkStatus: "benchmark-beater",
          executionAssumptions: {
            marketMode: "spot",
            initialBalance: 10000,
            fees: { maker: 0.0009, taker: 0.0011 },
            slippage: { enabled: true, percentage: 0.0006 },
          },
          outOfSampleReturn: 18.8,
          benchmarkReturn: 12.4,
          excessReturn: 6.4,
          maxDrawdown: 11.7,
          sharpeRatio: 1.42,
          profitFactor: 1.31,
          totalTrades: 42,
          verifiedAt: expect.any(Number),
        },
      });
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects backtest promotion evidence when bot config no longer matches the source", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const insert = vi.fn();
    const sourceId = "2f297746-8cd2-47d1-8b3e-198489bb8e78";
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: sourceId,
            name: "Benchmark Evidence Backtest",
            strategy: "sma-crossover",
            strategyParams: { fastPeriod: 50, slowPeriod: 200 },
            exchange: "binance",
            symbol: "BTC/USDT",
            timeframe: "15m",
            status: "completed",
            metrics: {
              result: {
                benchmark: { totalReturn: 12.4 },
                excessReturn: 6.4,
              },
            },
            deletedAt: null,
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
            redis: {} as never,
            queues: {} as never,
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
        caller.bots.create({
          name: "Tampered Backtest Paper Bot",
          strategy: "sma-crossover",
          strategyParams: { fastPeriod: 9, slowPeriod: 21 },
          exchange: "coinbase",
          symbol: "SOL/USDT",
          timeframe: "1h",
          mode: "paper",
          riskConfig: {
            maxPositionSizePercent: 10,
            maxDrawdownPercent: 20,
            riskPerTradePercent: 2,
            maxConcurrentPositions: 5,
            maxDailyLossPercent: 5,
            trailingStopEnabled: false,
            trailingStopPercent: 5,
          },
          currentBalance: 10000,
          promotionEvidence: {
            sourceType: "backtest",
            sourceId,
          },
        })
      ).rejects.toThrow(/exact backtest replays/);

      expect(insert).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects research promotion evidence that failed historical-profit gates", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const insert = vi.fn();
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f",
            qualified: false,
            testMetrics: { excessReturn: 5 },
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
            redis: {} as never,
            queues: {} as never,
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
        caller.bots.create({
          name: "Research Paper Bot",
          strategy: "sma-crossover",
          strategyParams: { fastPeriod: 9, slowPeriod: 21 },
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "1h",
          mode: "paper",
          riskConfig: {
            maxPositionSizePercent: 10,
            maxDrawdownPercent: 20,
            riskPerTradePercent: 2,
            maxConcurrentPositions: 5,
            maxDailyLossPercent: 5,
            trailingStopEnabled: false,
            trailingStopPercent: 5,
          },
          currentBalance: 10000,
          promotionEvidence: {
            sourceType: "research",
            sourceId: "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f",
          },
        })
      ).rejects.toThrow(/not historically profitable/);

      expect(insert).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects live-mode updates for evidence-promoted paper bots", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const update = vi.fn();
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e",
            name: "Research Paper Bot",
            strategy: "sma-crossover",
            strategyParams: {},
            exchange: "binance",
            symbol: "BTC/USDT",
            timeframe: "1h",
            mode: "paper",
            status: "idle",
            riskConfig: {},
            promotionEvidence: {
              sourceType: "research",
              sourceId: "6f615fb0-a36c-4cfe-8d90-95bdfaa0f72f",
            },
            currentBalance: "10000",
            totalPnl: "0",
            totalTrades: "0",
            winRate: "0",
            errorMessage: null,
            startedAt: null,
            stoppedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
      ),
      update,
    };

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: {} as never,
            queues: {} as never,
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
        caller.bots.update({
          botId: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e",
          config: { mode: "live" },
        })
      ).rejects.toThrow(/must remain in paper mode/);

      expect(update).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects config drift on evidence-promoted paper bots without fresh source evidence", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const update = vi.fn();
    const db = {
      select: vi.fn(() =>
        createQueryBuilder([
          {
            id: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e",
            name: "Backtest Paper Bot",
            strategy: "sma-crossover",
            strategyParams: { fastPeriod: 50, slowPeriod: 200 },
            exchange: "binance",
            symbol: "BTC/USDT",
            timeframe: "15m",
            mode: "paper",
            status: "idle",
            riskConfig: {},
            promotionEvidence: {
              sourceType: "backtest",
              sourceId: "2f297746-8cd2-47d1-8b3e-198489bb8e78",
            },
            currentBalance: "10000",
            totalPnl: "0",
            totalTrades: "0",
            winRate: "0",
            errorMessage: null,
            startedAt: null,
            stoppedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
      ),
      update,
    };

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: {} as never,
            queues: {} as never,
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
        caller.bots.update({
          botId: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e",
          config: {
            strategyParams: { fastPeriod: 9, slowPeriod: 21 },
            symbol: "SOL/USDT",
          },
        })
      ).rejects.toThrow(/cannot change evidence-bound config/);

      expect(update).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("returns server-side bot equity, drawdown, and profit-factor evidence", async () => {
    const botId = "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e";
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const db = createDbMock([
      [
        {
          id: botId,
          name: "Evidence Bot",
          strategy: "sma-crossover",
          strategyParams: {},
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "1h",
          mode: "paper",
          status: "running",
          riskConfig: {},
          promotionEvidence: {},
          currentBalance: "10300",
          totalPnl: "0",
          totalTrades: "0",
          winRate: "0",
          errorMessage: null,
          startedAt,
          stoppedAt: null,
          createdAt: startedAt,
          updatedAt: startedAt,
        },
      ],
      [
        {
          botId,
          symbol: "BTC/USDT",
          side: "sell",
          type: "market",
          amount: "0.1",
          price: "71000",
          cost: "7100",
          fee: "1",
          pnl: "-50",
          pnlPercent: "-0.5",
          executedAt: new Date("2026-01-04T00:00:00.000Z"),
        },
        {
          botId,
          symbol: "BTC/USDT",
          side: "sell",
          type: "market",
          amount: "0.1",
          price: "70000",
          cost: "7000",
          fee: "1",
          pnl: "200",
          pnlPercent: "2",
          executedAt: new Date("2026-01-03T00:00:00.000Z"),
        },
        {
          botId,
          symbol: "BTC/USDT",
          side: "sell",
          type: "market",
          amount: "0.1",
          price: "69000",
          cost: "6900",
          fee: "1",
          pnl: "100",
          pnlPercent: "1",
          executedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ],
    ]);

    const caller = createCaller(
      createTrpcContext(
        {
          db: db as never,
          redis: {} as never,
          queues: {} as never,
          exchangeManager: {} as never,
          marketData: {} as never,
          keyVault: {} as never,
          exportsDir: "/tmp/exports",
        },
        { headers: {} } as never
      )
    );

    const metrics = await caller.bots.getMetrics({ botId });

    expect(metrics).toMatchObject({
      currentBalance: 10300,
      startingBalance: 10050,
      totalPnl: 250,
      totalTrades: 3,
      wins: 2,
      losses: 1,
      winRate: (2 / 3) * 100,
      averageTradePnl: 250 / 3,
      grossProfit: 300,
      grossLoss: 50,
      profitFactor: 6,
    });
    expect(metrics.equityCurve).toEqual([
      { time: Date.parse("2026-01-01T00:00:00.000Z"), equity: 10050 },
      { time: Date.parse("2026-01-02T00:00:00.000Z"), equity: 10150 },
      { time: Date.parse("2026-01-03T00:00:00.000Z"), equity: 10350 },
      { time: Date.parse("2026-01-04T00:00:00.000Z"), equity: 10300 },
    ]);
    expect(metrics.maxDrawdown).toBeCloseTo((50 / 10350) * 100, 6);
    expect(metrics.drawdownCurve.at(-1)?.drawdown).toBeCloseTo((50 / 10350) * 100, 6);
  });

  it("dispatches a start job and publishes a status update", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const db = createDbMock([
      [
        {
          id: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e",
          name: "Momentum Bot",
          strategy: "sma-crossover",
          strategyParams: {},
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "1h",
          mode: "paper",
          status: "idle",
          riskConfig: {},
          currentBalance: "10000",
          totalPnl: "0",
          totalTrades: "0",
          winRate: "0",
          errorMessage: null,
          startedAt: null,
          stoppedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    ]);
    const add = vi.fn().mockResolvedValue({ id: "job-1" });
    const publish = vi.fn().mockResolvedValue(1);

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: { publish } as never,
            queues: {
              botExecutionQueue: { add },
              backtestQueue: {},
              dataExportQueue: {},
              close: async () => undefined,
            } as never,
            exchangeManager: {} as never,
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

      const result = await caller.bots.start({ botId: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e" });

      expect(result).toEqual({ success: true, jobId: "job-1" });
      expect(add).toHaveBeenCalledWith(
        "start-bot",
        { botId: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e" },
        expect.objectContaining({
          jobId: expect.stringMatching(/^bot-d5d64559-5a73-4389-bc6a-1ac9e8a67c2e-start-/),
        })
      );
      expect(publish).toHaveBeenCalledWith("bot:status", expect.stringContaining("starting"));
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rolls back bot start state when queueing fails", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    const previousAppMode = process.env["APP_MODE"];
    process.env["API_AUTH_TOKEN"] = "test-token";
    delete process.env["APP_MODE"];

    const botId = "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e";
    const { db, updates } = createBotControlDb(botControlRow("idle"));
    const remove = vi.fn(async () => undefined);
    const add = vi.fn().mockRejectedValue(new Error("redis down"));
    const getJob = vi.fn().mockResolvedValue({ remove });
    const publish = vi.fn().mockResolvedValue(1);

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: { publish } as never,
            queues: {
              botExecutionQueue: { add, getJob },
              backtestQueue: {},
              dataExportQueue: {},
              close: async () => undefined,
            } as never,
            exchangeManager: {} as never,
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

      await expect(caller.bots.start({ botId })).rejects.toThrow(/Failed to enqueue bot start job/);

      expect(updates[0]).toMatchObject({ status: "starting", errorMessage: null });
      expect(updates[1]).toMatchObject({ status: "idle", errorMessage: null, startedAt: null });
      expect(getJob).toHaveBeenCalledWith(expect.stringMatching(/^bot-.+-start-/));
      expect(remove).toHaveBeenCalledTimes(1);
      expect(publish).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
      if (previousAppMode === undefined) {
        delete process.env["APP_MODE"];
      } else {
        process.env["APP_MODE"] = previousAppMode;
      }
    }
  });

  it("rolls back bot pause state when queueing fails", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    const previousAppMode = process.env["APP_MODE"];
    process.env["API_AUTH_TOKEN"] = "test-token";
    delete process.env["APP_MODE"];

    const botId = "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e";
    const { db, updates } = createBotControlDb(botControlRow("running"));
    const remove = vi.fn(async () => undefined);
    const add = vi.fn().mockRejectedValue(new Error("redis down"));
    const getJob = vi.fn().mockResolvedValue({ remove });
    const publish = vi.fn().mockResolvedValue(1);

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: { publish } as never,
            queues: {
              botExecutionQueue: { add, getJob },
              backtestQueue: {},
              dataExportQueue: {},
              close: async () => undefined,
            } as never,
            exchangeManager: {} as never,
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

      await expect(caller.bots.pause({ botId })).rejects.toThrow(/Failed to enqueue bot pause job/);

      expect(updates[0]).toMatchObject({ status: "paused" });
      expect(updates[1]).toMatchObject({ status: "running" });
      expect(getJob).toHaveBeenCalledWith(expect.stringMatching(/^bot-.+-pause-/));
      expect(remove).toHaveBeenCalledTimes(1);
      expect(publish).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
      if (previousAppMode === undefined) {
        delete process.env["APP_MODE"];
      } else {
        process.env["APP_MODE"] = previousAppMode;
      }
    }
  });

  it("rolls back bot stop state when queueing fails", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    const previousAppMode = process.env["APP_MODE"];
    process.env["API_AUTH_TOKEN"] = "test-token";
    delete process.env["APP_MODE"];

    const botId = "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e";
    const previousStoppedAt = new Date("2025-12-31T00:00:00.000Z");
    const { db, updates } = createBotControlDb(
      botControlRow("paused", { stoppedAt: previousStoppedAt })
    );
    const remove = vi.fn(async () => undefined);
    const add = vi.fn().mockRejectedValue(new Error("redis down"));
    const getJob = vi.fn().mockResolvedValue({ remove });
    const publish = vi.fn().mockResolvedValue(1);

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: { publish } as never,
            queues: {
              botExecutionQueue: { add, getJob },
              backtestQueue: {},
              dataExportQueue: {},
              close: async () => undefined,
            } as never,
            exchangeManager: {} as never,
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

      await expect(caller.bots.stop({ botId })).rejects.toThrow(/Failed to enqueue bot stop job/);

      expect(updates[0]).toMatchObject({ status: "stopped" });
      expect(updates[1]).toMatchObject({ status: "paused", stoppedAt: previousStoppedAt });
      expect(getJob).toHaveBeenCalledWith(expect.stringMatching(/^bot-.+-stop-/));
      expect(remove).toHaveBeenCalledTimes(1);
      expect(publish).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
      if (previousAppMode === undefined) {
        delete process.env["APP_MODE"];
      } else {
        process.env["APP_MODE"] = previousAppMode;
      }
    }
  });
});
