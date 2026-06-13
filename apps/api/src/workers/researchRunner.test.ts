import { describe, expect, it, vi } from "vitest";

import type {
  MarketCandle,
  MarketCandleStreamParams,
  MarketDataReader,
} from "../services/harvesterMarketData";

import { runResearchSweepJob } from "./researchRunner";

function createQueryBuilder<T>(rows: T[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (value: T[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };

  return builder;
}

function createDbMock(sweepId: string) {
  const insertedResults: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const selectRows = [
    [
      {
        id: sweepId,
        name: "Streaming sweep",
        status: "pending",
        config: {
          exchange: "binance",
          symbols: ["BTC/USDT", "ETH/USDT"],
          timeframes: ["1h"],
          strategyKeys: ["sma-crossover"],
          allowFallbackRollups: true,
        },
        symbols: ["BTC/USDT", "ETH/USDT"],
        timeframes: ["1h"],
        strategyKeys: ["sma-crossover"],
        bestResultId: null,
        error: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        startedAt: null,
        completedAt: null,
      },
    ],
    [{ id: "best-result" }],
  ];

  const db = {
    select: vi.fn(() => createQueryBuilder(selectRows.shift() ?? [])),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updates.push(values);
        return {
          where: vi.fn(async () => []),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        insertedResults.push(values);
        return [];
      }),
    })),
  };

  return { db, insertedResults, updates };
}

describe("researchRunner", () => {
  it("loads one symbol dataset at a time before aggregating sweep results", async () => {
    const sweepId = "7567e99f-5c2b-408b-b886-088162236683";
    const { db, insertedResults, updates } = createDbMock(sweepId);
    const marketData = new SequentialFakeMarketDataReader(["BTC/USDT", "ETH/USDT"]);
    const publish = vi.fn().mockResolvedValue(1);
    const updateProgress = vi.fn(async () => undefined);

    const result = await runResearchSweepJob(
      {
        db: db as never,
        redis: { publish } as never,
        marketData,
      },
      sweepId,
      { updateProgress }
    );

    expect(result).toEqual({ sweepId, status: "completed", candidates: 10 });
    expect(marketData.maxActiveStreams).toBe(1);
    expect(marketData.streamOrder).toEqual([
      "start:BTC/USDT",
      "end:BTC/USDT",
      "start:ETH/USDT",
      "end:ETH/USDT",
    ]);
    expect(insertedResults).toHaveLength(10);
    expect(insertedResults[0]).toMatchObject({
      sweepId,
      strategy: "sma-crossover",
      timeframe: "1h",
      marketMode: "spot",
      symbols: ["BTC/USDT", "ETH/USDT"],
      testMetrics: {
        executionAssumptions: {
          marketMode: "spot",
          initialBalance: 10_000,
          fees: { maker: 0.001, taker: 0.001 },
          slippage: { enabled: true, percentage: 0.0005 },
        },
      },
    });
    expect(insertedResults[0]?.perSymbolResults).toHaveLength(2);
    expect(updates[0]).toMatchObject({ status: "running", error: null });
    expect(updates.at(-1)).toMatchObject({ status: "completed", bestResultId: "best-result" });
    expect(updateProgress).toHaveBeenCalledWith(100);
    expect(publish).toHaveBeenCalledWith(
      "research:progress",
      expect.stringContaining("loading-symbol-data")
    );
    const firstProgressPayload = JSON.parse(publish.mock.calls[0]?.[1] as string) as {
      symbolIndex?: number;
      symbolCount?: number;
    };
    expect(firstProgressPayload).toMatchObject({ symbolIndex: 1, symbolCount: 2 });
  });

  it("does not fail a sweep when best-effort progress reporting fails", async () => {
    const sweepId = "7567e99f-5c2b-408b-b886-088162236683";
    const { db, insertedResults, updates } = createDbMock(sweepId);
    const marketData = new SequentialFakeMarketDataReader(["BTC/USDT", "ETH/USDT"]);
    const publish = vi.fn().mockRejectedValue(new Error("pubsub unavailable"));
    const updateProgress = vi.fn().mockRejectedValue(new Error("bullmq progress unavailable"));

    const result = await runResearchSweepJob(
      {
        db: db as never,
        redis: { publish } as never,
        marketData,
      },
      sweepId,
      { updateProgress }
    );

    expect(result).toEqual({ sweepId, status: "completed", candidates: 10 });
    expect(insertedResults).toHaveLength(10);
    expect(updates.at(-1)).toMatchObject({ status: "completed", bestResultId: "best-result" });
    expect(updateProgress).toHaveBeenCalled();
    expect(publish).toHaveBeenCalled();
  });
});

class SequentialFakeMarketDataReader implements MarketDataReader {
  activeStreams = 0;
  maxActiveStreams = 0;
  streamOrder: string[] = [];
  private readonly candlesBySymbol = new Map<string, MarketCandle[]>();

  constructor(symbols: string[]) {
    for (const symbol of symbols) {
      this.candlesBySymbol.set(symbol, buildCandles(symbol));
    }
  }

  async getLatestCandle(_exchange: string, symbol: string) {
    return this.candlesBySymbol.get(symbol)?.at(-1) ?? null;
  }

  async getCandles() {
    return [];
  }

  async *streamCandles(params: MarketCandleStreamParams) {
    this.activeStreams++;
    this.maxActiveStreams = Math.max(this.maxActiveStreams, this.activeStreams);
    this.streamOrder.push(`start:${params.symbol}`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      yield this.candlesBySymbol.get(params.symbol) ?? [];
    } finally {
      this.streamOrder.push(`end:${params.symbol}`);
      this.activeStreams--;
    }
  }

  async getSymbols() {
    return [...this.candlesBySymbol.keys()];
  }

  async getCoverage(_exchange: string, symbol: string) {
    const candles = this.candlesBySymbol.get(symbol) ?? [];
    return {
      earliest: candles[0]?.time ?? null,
      latest: candles.at(-1)?.time ?? null,
      totalCandles: candles.length,
      gapCount: 0,
    };
  }

  async getQualityMetrics() {
    return [];
  }
}

function buildCandles(symbol: string): MarketCandle[] {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: 240 }, (_, index) => {
    const trend = 100 + index * 0.3;
    const wave = Math.sin(index / 5) * 4;
    const close = trend + wave + (symbol.startsWith("ETH") ? 12 : 0);
    return {
      exchange: "binance",
      symbol,
      timeframe: "1h",
      time: new Date(start + index * 60 * 60 * 1000),
      open: String(close - 0.6),
      high: String(close + 1.2),
      low: String(close - 1.2),
      close: String(close),
      volume: "100",
      tradesCount: 10,
    };
  });
}
