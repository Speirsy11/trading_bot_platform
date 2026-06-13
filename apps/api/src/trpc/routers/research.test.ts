import type { researchResults, researchSweeps } from "@tb/db";
import { describe, expect, it, vi } from "vitest";

import type { MarketQualityMetric } from "../../services/harvesterMarketData";
import { createTrpcContext } from "../context";
import { createCaller } from "../router";

import {
  buildLeaderboardFilterPlan,
  buildSweepDetailResponse,
  summarizeBenchmarkEvidence,
} from "./research";

function metric(
  symbol: string,
  timeframe: string,
  status: string,
  totalCandles = 100
): MarketQualityMetric {
  return {
    exchange: "binance",
    symbol,
    timeframe,
    totalCandles,
    gapCount: 0,
    earliest: totalCandles > 0 ? "2024-01-01T00:00:00.000Z" : null,
    latest: totalCandles > 0 ? "2024-01-02T00:00:00.000Z" : null,
    startTime: totalCandles > 0 ? "2024-01-01T00:00:00.000Z" : null,
    nextStartTime: null,
    latestAvailableTime: totalCandles > 0 ? "2024-01-02T00:00:00.000Z" : null,
    latestCandleAgeMs: 0,
    websocketStatus: "external",
    restFallbackCount: 0,
    validationFailures: 0,
    apiErrors: 0,
    repairFailures: 0,
    backfillBacklog: 0,
    candlesInserted: totalCandles,
    missingCandles: 0,
    completenessPct: totalCandles > 0 ? "100.00" : "0.00",
    lastUpdated: totalCandles > 0 ? "2024-01-02T00:01:00.000Z" : null,
    status,
  };
}

function createQueryBuilder<T>(rows: T[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    groupBy: () => builder,
    limit: () => builder,
    then: (resolve: (value: T[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };

  return builder;
}

describe("research router", () => {
  it("builds deterministic leaderboard filter plans for evidence statuses", () => {
    expect(buildLeaderboardFilterPlan({ evidenceStatus: "all", qualifiedOnly: false })).toEqual({
      requiresQualified: false,
      requiresUnqualified: false,
      requiresBenchmarkBeat: false,
      strategyKeys: [],
      timeframes: [],
    });

    expect(
      buildLeaderboardFilterPlan({
        evidenceStatus: "historically-profitable",
        qualifiedOnly: false,
      })
    ).toMatchObject({
      requiresQualified: true,
      requiresUnqualified: false,
      requiresBenchmarkBeat: false,
    });

    expect(
      buildLeaderboardFilterPlan({
        evidenceStatus: "alpha-qualified",
        qualifiedOnly: false,
        strategyKeys: ["sma-crossover"],
        timeframes: ["15m"],
      })
    ).toEqual({
      requiresQualified: true,
      requiresUnqualified: false,
      requiresBenchmarkBeat: true,
      strategyKeys: ["sma-crossover"],
      timeframes: ["15m"],
    });

    expect(
      buildLeaderboardFilterPlan({
        evidenceStatus: "benchmark-beater",
        qualifiedOnly: false,
      })
    ).toMatchObject({
      requiresQualified: false,
      requiresUnqualified: false,
      requiresBenchmarkBeat: true,
    });

    expect(
      buildLeaderboardFilterPlan({
        evidenceStatus: "unqualified",
        qualifiedOnly: true,
      })
    ).toMatchObject({
      requiresQualified: false,
      requiresUnqualified: true,
      requiresBenchmarkBeat: false,
    });
  });

  it("classifies historical profit separately from benchmark alpha", () => {
    expect(
      summarizeBenchmarkEvidence({
        qualified: true,
        testMetrics: {
          benchmark: { totalReturn: 120 },
          excessReturn: -30,
          drawdownAdvantage: 40,
        },
      })
    ).toMatchObject({
      alphaQualified: false,
      benchmarkBeat: false,
      paperBotEligible: true,
      benchmarkStatus: "profit-only",
      benchmarkReturn: 120,
      excessReturn: -30,
      drawdownAdvantage: 40,
    });

    expect(
      summarizeBenchmarkEvidence({
        qualified: true,
        testMetrics: {
          benchmark: { totalReturn: 20 },
          excessReturn: 5,
        },
      })
    ).toMatchObject({
      alphaQualified: true,
      benchmarkBeat: true,
      paperBotEligible: true,
      benchmarkStatus: "alpha-qualified",
    });

    expect(
      summarizeBenchmarkEvidence({
        qualified: false,
        testMetrics: {
          benchmark: { totalReturn: 20 },
          excessReturn: 5,
        },
      })
    ).toMatchObject({
      alphaQualified: false,
      benchmarkBeat: true,
      paperBotEligible: false,
      benchmarkStatus: "benchmark-beater",
    });
  });

  it("builds one authoritative sweep-detail payload with top result evidence", () => {
    const sweep = {
      id: "7567e99f-5c2b-408b-b886-088162236683",
      name: "Top 10 spot research sweep",
      status: "completed",
      config: { engineVersion: "research-lab-test", exchange: "binance" },
      symbols: ["BTC/USDT", "ETH/USDT"],
      timeframes: ["15m"],
      strategyKeys: ["sma-crossover"],
      bestResultId: null,
      error: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      startedAt: new Date("2026-01-01T00:01:00.000Z"),
      completedAt: new Date("2026-01-01T00:02:00.000Z"),
    } as typeof researchSweeps.$inferSelect;

    const topRow = {
      id: "43ff12fb-d236-4f91-b877-f5db9ecd145b",
      sweepId: sweep.id,
      strategy: "sma-crossover",
      strategyName: "SMA Crossover",
      strategyParams: { fastPeriod: 50, slowPeriod: 200 },
      paramHash: "hash-a",
      timeframe: "15m",
      marketMode: "spot",
      symbols: ["BTC/USDT", "ETH/USDT"],
      trainMetrics: { totalReturn: 12 },
      validationMetrics: { totalReturn: 8 },
      testMetrics: {
        totalReturn: 18,
        benchmark: { totalReturn: 10, equityCurve: [{ time: 1, equity: 11_000 }] },
        excessReturn: 8,
        executionAssumptions: {
          marketMode: "spot",
          initialBalance: 10_000,
          fees: { maker: 0.001, taker: 0.001 },
          slippage: { enabled: true, percentage: 0.0005 },
        },
      },
      perSymbolResults: [{ symbol: "BTC/USDT", splits: { test: { metrics: { totalReturn: 9 } } } }],
      portfolioEquityCurve: [{ time: 1, equity: 11_800 }],
      drawdownCurve: [{ time: 1, drawdown: 4 }],
      dataCoverage: [{ symbol: "BTC/USDT", timeframe: "15m", totalCandles: 100 }],
      qualified: true,
      qualificationReasons: ["Passed out-of-sample robustness gates"],
      outOfSampleReturn: "18",
      maxDrawdown: "12",
      sharpeRatio: "1.4",
      profitFactor: "1.2",
      winRate: "54",
      totalTrades: "60",
      positiveSymbols: "2",
      createdAt: new Date("2026-01-01T00:02:00.000Z"),
    } as typeof researchResults.$inferSelect;

    const detail = buildSweepDetailResponse({
      sweep,
      progress: 100,
      resultCount: 2,
      stats: { total: 2, qualified: 1, benchmarkBeat: 1, alphaQualified: 1 },
      resultRows: [topRow],
    });

    expect(detail.sweep).toMatchObject({
      id: sweep.id,
      progress: 100,
      resultCount: 2,
      engineVersion: "research-lab-test",
      completedAt: "2026-01-01T00:02:00.000Z",
    });
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]).toMatchObject({
      id: topRow.id,
      qualified: true,
      alphaQualified: true,
      benchmarkBeat: true,
      benchmarkStatus: "alpha-qualified",
      excessReturn: 8,
      executionAssumptions: {
        marketMode: "spot",
        initialBalance: 10_000,
        fees: { maker: 0.001, taker: 0.001 },
        slippage: { enabled: true, percentage: 0.0005 },
      },
    });
    expect(detail.topResult).toMatchObject({
      id: topRow.id,
      sourceSweep: {
        id: sweep.id,
        engineVersion: "research-lab-test",
        config: { engineVersion: "research-lab-test", exchange: "binance" },
      },
      portfolioEquityCurve: [{ time: 1, equity: 11_800 }],
      perSymbolResults: [{ symbol: "BTC/USDT" }],
    });
  });

  it("returns result details with the source sweep config envelope", async () => {
    const resultId = "43ff12fb-d236-4f91-b877-f5db9ecd145b";
    const sweepId = "7567e99f-5c2b-408b-b886-088162236683";
    const selectRows = [
      [
        {
          id: resultId,
          sweepId,
          strategy: "sma-crossover",
          strategyName: "SMA Crossover",
          strategyParams: { fastPeriod: 50, slowPeriod: 200 },
          paramHash: "hash-a",
          timeframe: "15m",
          marketMode: "spot",
          symbols: ["BTC/USDT", "ETH/USDT"],
          trainMetrics: { totalReturn: 12 },
          validationMetrics: { totalReturn: 8 },
          testMetrics: {
            totalReturn: 18,
            benchmark: { totalReturn: 10 },
            excessReturn: 8,
            executionAssumptions: {
              marketMode: "spot",
              initialBalance: 10_000,
              fees: { maker: 0.001, taker: 0.001 },
              slippage: { enabled: true, percentage: 0.0005 },
            },
          },
          perSymbolResults: [{ symbol: "BTC/USDT" }],
          portfolioEquityCurve: [{ time: 1, equity: 11_800 }],
          drawdownCurve: [{ time: 1, drawdown: 4 }],
          dataCoverage: [{ symbol: "BTC/USDT", timeframe: "15m", totalCandles: 100 }],
          qualified: true,
          qualificationReasons: ["Passed out-of-sample robustness gates"],
          outOfSampleReturn: "18",
          maxDrawdown: "12",
          sharpeRatio: "1.4",
          profitFactor: "1.2",
          winRate: "54",
          totalTrades: "60",
          positiveSymbols: "2",
          createdAt: new Date("2026-01-01T00:02:00.000Z"),
        } as typeof researchResults.$inferSelect,
      ],
      [
        {
          id: sweepId,
          name: "Top 10 spot research sweep",
          status: "completed",
          config: {
            engineVersion: "research-lab-test",
            exchange: "binance",
            symbols: ["BTC/USDT", "ETH/USDT"],
            timeframes: ["15m"],
            strategyKeys: ["sma-crossover"],
            executionAssumptions: {
              marketMode: "spot",
              initialBalance: 10_000,
              fees: { maker: 0.001, taker: 0.001 },
              slippage: { enabled: true, percentage: 0.0005 },
            },
          },
          symbols: ["BTC/USDT", "ETH/USDT"],
          timeframes: ["15m"],
          strategyKeys: ["sma-crossover"],
          bestResultId: resultId,
          error: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          startedAt: new Date("2026-01-01T00:01:00.000Z"),
          completedAt: new Date("2026-01-01T00:02:00.000Z"),
        } as typeof researchSweeps.$inferSelect,
      ],
    ];
    const select = vi.fn(() => createQueryBuilder(selectRows.shift() ?? []));

    const caller = createCaller(
      createTrpcContext(
        {
          db: { select } as never,
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

    const detail = await caller.research.getResult({ resultId });

    expect(select).toHaveBeenCalledTimes(2);
    expect(detail).toMatchObject({
      id: resultId,
      sweepId,
      sourceSweep: {
        id: sweepId,
        name: "Top 10 spot research sweep",
        engineVersion: "research-lab-test",
        config: {
          symbols: ["BTC/USDT", "ETH/USDT"],
          timeframes: ["15m"],
          strategyKeys: ["sma-crossover"],
          executionAssumptions: {
            marketMode: "spot",
            initialBalance: 10_000,
            fees: { maker: 0.001, taker: 0.001 },
            slippage: { enabled: true, percentage: 0.0005 },
          },
        },
        completedAt: "2026-01-01T00:02:00.000Z",
      },
      executionAssumptions: {
        marketMode: "spot",
        initialBalance: 10_000,
        fees: { maker: 0.001, taker: 0.001 },
        slippage: { enabled: true, percentage: 0.0005 },
      },
    });
  });

  it("counts sweep results with a database aggregate instead of materializing result ids", async () => {
    const sweepId = "7567e99f-5c2b-408b-b886-088162236683";
    const selectRows = [
      [
        {
          id: sweepId,
          name: "Top 10 spot research sweep",
          status: "running",
          config: { engineVersion: "research-lab-test", exchange: "binance" },
          symbols: ["BTC/USDT", "ETH/USDT"],
          timeframes: ["15m"],
          strategyKeys: ["sma-crossover"],
          bestResultId: null,
          error: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          startedAt: new Date("2026-01-01T00:01:00.000Z"),
          completedAt: null,
        } as typeof researchSweeps.$inferSelect,
      ],
      [{ count: 183 }],
    ];
    const select = vi.fn(() => createQueryBuilder(selectRows.shift() ?? []));
    const getJob = vi.fn().mockResolvedValue({ progress: 37 });

    const caller = createCaller(
      createTrpcContext(
        {
          db: { select } as never,
          redis: {} as never,
          queues: {
            researchQueue: { getJob },
            close: async () => undefined,
          } as never,
          exchangeManager: {} as never,
          marketData: {} as never,
          keyVault: {} as never,
          exportsDir: "/tmp/exports",
        },
        { headers: {} } as never
      )
    );

    const result = await caller.research.getSweep({ sweepId });

    expect(result).toMatchObject({
      id: sweepId,
      progress: 37,
      resultCount: 183,
    });
    expect(select).toHaveBeenCalledTimes(2);
    expect(select.mock.calls[1]?.[0]).toHaveProperty("count");
    expect(select.mock.calls[1]?.[0]).not.toHaveProperty("id");
  });

  it("rejects unsupported research sweep strategy keys and timeframes before queueing", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const insert = vi.fn();
    const add = vi.fn();
    const getQualityMetrics = vi.fn();

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: { insert } as never,
            redis: {} as never,
            queues: {
              researchQueue: { add },
              close: async () => undefined,
            } as never,
            exchangeManager: {} as never,
            marketData: { getQualityMetrics } as never,
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
        caller.research.runSweep({
          symbols: ["BTC/USDT"],
          timeframes: ["5m" as never],
          strategyKeys: ["martingale-grid" as never],
          allowFallbackRollups: true,
        })
      ).rejects.toThrow();

      expect(getQualityMetrics).not.toHaveBeenCalled();
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

  it("normalizes duplicate sweep arrays before persisting and queueing research", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const sweepId = "7567e99f-5c2b-408b-b886-088162236683";
    const insertedValues: Array<Record<string, unknown>> = [];
    const values = vi.fn((row: Record<string, unknown>) => {
      insertedValues.push(row);
      return {
        returning: vi.fn().mockResolvedValue([{ id: sweepId }]),
      };
    });
    const insert = vi.fn(() => ({ values }));
    const add = vi.fn().mockResolvedValue({ id: `research-${sweepId}` });
    const getQualityMetrics = vi.fn();

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: { insert } as never,
            redis: {} as never,
            queues: {
              researchQueue: { add },
              close: async () => undefined,
            } as never,
            exchangeManager: {} as never,
            marketData: { getQualityMetrics } as never,
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

      const result = await caller.research.runSweep({
        symbols: ["btc/usdt", "BTC/USDT", "eth/usdt"],
        timeframes: ["1h", "1h"],
        strategyKeys: ["sma-crossover", "sma-crossover"],
        allowFallbackRollups: true,
      });

      expect(result).toMatchObject({
        sweepId,
        candidateCount: 10,
      });
      expect(insertedValues[0]).toMatchObject({
        symbols: ["BTC/USDT", "ETH/USDT"],
        timeframes: ["1h"],
        strategyKeys: ["sma-crossover"],
      });
      expect(insertedValues[0]?.config).toMatchObject({
        symbols: ["BTC/USDT", "ETH/USDT"],
        timeframes: ["1h"],
        strategyKeys: ["sma-crossover"],
        executionAssumptions: {
          marketMode: "spot",
          initialBalance: 10_000,
          fees: { maker: 0.001, taker: 0.001 },
          slippage: { enabled: true, percentage: 0.0005 },
        },
      });
      expect(getQualityMetrics).not.toHaveBeenCalled();
      expect(add).toHaveBeenCalledWith(
        "run-research-sweep",
        { sweepId },
        expect.objectContaining({ jobId: `research-${sweepId}` })
      );
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("deletes the inserted sweep row when research queueing fails", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const sweepId = "7567e99f-5c2b-408b-b886-088162236683";
    const deleteWhere = vi.fn(async () => []);
    const remove = vi.fn(async () => undefined);
    const values = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: sweepId }]),
    }));
    const db = {
      insert: vi.fn(() => ({ values })),
      delete: vi.fn(() => ({ where: deleteWhere })),
    };
    const add = vi.fn().mockRejectedValue(new Error("redis down"));
    const getJob = vi.fn().mockResolvedValue({ remove });

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: db as never,
            redis: {} as never,
            queues: {
              researchQueue: { add, getJob },
              close: async () => undefined,
            } as never,
            exchangeManager: {} as never,
            marketData: { getQualityMetrics: vi.fn() } as never,
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
        caller.research.runSweep({
          symbols: ["BTC/USDT"],
          timeframes: ["1h"],
          strategyKeys: ["sma-crossover"],
          allowFallbackRollups: true,
        })
      ).rejects.toThrow(/Failed to enqueue research sweep job/);

      expect(add).toHaveBeenCalledWith(
        "run-research-sweep",
        { sweepId },
        expect.objectContaining({ jobId: `research-${sweepId}` })
      );
      expect(getJob).toHaveBeenCalledWith(`research-${sweepId}`);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(deleteWhere).toHaveBeenCalledTimes(1);
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("rejects sweeps that require native rollups before all requested rollups are ready", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const insert = vi.fn();
    const getQualityMetrics = vi.fn().mockResolvedValue([metric("BTC/USDT", "4h", "complete")]);
    const add = vi.fn();

    try {
      const caller = createCaller(
        createTrpcContext(
          {
            db: { insert } as never,
            redis: {} as never,
            queues: {
              researchQueue: { add },
              close: async () => undefined,
            } as never,
            exchangeManager: {} as never,
            marketData: { getQualityMetrics } as never,
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
        caller.research.runSweep({
          symbols: ["BTC/USDT", "ETH/USDT"],
          timeframes: ["4h"],
          strategyKeys: ["sma-crossover"],
        })
      ).rejects.toThrow(/ready for 1\/2 requested symbol\/timeframe pairs; 1 still block/);

      expect(getQualityMetrics).toHaveBeenCalledWith({ exchange: "binance" });
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
