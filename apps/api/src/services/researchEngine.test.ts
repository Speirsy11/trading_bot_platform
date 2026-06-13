import { StrategyRegistry } from "@tb/trading-core";
import { describe, expect, it } from "vitest";

import type {
  MarketCandle,
  MarketCandleStreamParams,
  MarketDataReader,
} from "./harvesterMarketData";
import {
  aggregateSplit,
  applyPortfolioCurveMetrics,
  buildResearchCandidateResult,
  buildResearchCandidates,
  buildSplitBenchmarks,
  buildTimeAlignedEqualWeightCurve,
  calculatePortfolioSharpeRatio,
  loadResearchDataset,
  loadResearchSymbolDataset,
  qualifyResearchResult,
  runResearchCandidateOnDataset,
  runResearchCandidateOnSymbolDataset,
  runBuyAndHoldBenchmark,
  splitCandles,
  type AggregateMetrics,
  type SplitSummary,
} from "./researchEngine";
import { bootstrapStrategies } from "./strategyCatalog";

describe("researchEngine", () => {
  it("builds the configured transparent technical candidate grid", () => {
    const candidates = buildResearchCandidates({
      timeframes: ["1h"],
      strategyKeys: ["sma-crossover", "donchian-breakout"],
    });

    expect(candidates).toHaveLength(19);
    expect(candidates.every((candidate) => candidate.timeframe === "1h")).toBe(true);
    expect(candidates.some((candidate) => candidate.strategy === "sma-crossover")).toBe(true);
    expect(candidates.some((candidate) => candidate.strategy === "donchian-breakout")).toBe(true);
  });

  it("deduplicates candidate grids so repeated timeframes do not duplicate evidence runs", () => {
    const candidates = buildResearchCandidates({
      timeframes: ["1h", "1h"],
      strategyKeys: ["sma-crossover", "sma-crossover"],
    });
    const uniqueHashes = new Set(candidates.map((candidate) => candidate.paramHash));

    expect(candidates).toHaveLength(10);
    expect(uniqueHashes.size).toBe(candidates.length);
  });

  it("covers the full V1 parameter grid with executable strategy params", () => {
    bootstrapStrategies();

    const candidates = buildResearchCandidates({ timeframes: ["4h"] });
    const counts = countByStrategy(candidates);

    expect(candidates).toHaveLength(61);
    expect(counts).toEqual({
      "bollinger-long-bounce": 16,
      "donchian-breakout": 9,
      "ema-atr-trend": 8,
      "rsi-mean-reversion": 18,
      "sma-crossover": 10,
    });
    expect(
      candidates.filter(
        (candidate) =>
          candidate.strategy === "bollinger-long-bounce" &&
          candidate.strategyParams.exitBand === "upper"
      )
    ).toHaveLength(8);
    expect(
      candidates.filter(
        (candidate) =>
          candidate.strategy === "donchian-breakout" && candidate.strategyParams.atrStop === 0
      )
    ).toHaveLength(3);

    for (const candidate of candidates) {
      const strategy = StrategyRegistry.create(candidate.strategy);
      expect(() => strategy.paramsSchema.parse(candidate.strategyParams)).not.toThrow();
    }
  });

  it("splits candles chronologically into 70/15/15 windows", () => {
    const candles = Array.from({ length: 100 }, (_, index) => ({
      time: index,
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 1,
    }));

    const split = splitCandles(candles);

    expect(split.train).toHaveLength(70);
    expect(split.validation).toHaveLength(15);
    expect(split.test).toHaveLength(15);
    expect(split.train[69]?.time).toBe(69);
    expect(split.validation[0]?.time).toBe(70);
    expect(split.test[0]?.time).toBe(85);
  });

  it("requires every robustness gate before qualifying a result", () => {
    const passing: AggregateMetrics = {
      totalReturn: 12,
      netProfit: 12_000,
      maxDrawdown: 18,
      sharpeRatio: 1.4,
      profitFactor: 1.3,
      winRate: 54,
      totalTrades: 80,
      positiveSymbols: 7,
      participatingSymbols: 8,
      symbolCount: 10,
    };

    expect(qualifyResearchResult(passing).qualified).toBe(true);
    expect(qualifyResearchResult({ ...passing, maxDrawdown: 35, totalTrades: 12 })).toMatchObject({
      qualified: false,
      reasons: expect.arrayContaining([
        "Max drawdown is above 30%",
        "Fewer than 30 out-of-sample trades",
      ]),
    });
    expect(
      qualifyResearchResult({ ...passing, symbolCount: 2, participatingSymbols: 2 })
    ).toMatchObject({
      qualified: false,
      reasons: expect.arrayContaining([
        "Fewer than 10 symbols had complete test coverage",
        "Fewer than 6 symbols had non-trivial trade participation",
      ]),
    });
  });

  it("aggregates portfolio profit factor from pooled symbol trade P&L", () => {
    const aggregated = aggregateSplit(
      [
        buildSymbolSplit("BTC/USDT", {
          grossProfit: 10,
          grossLoss: 1,
          winningTrades: 1,
          losingTrades: 1,
          closedTrades: 2,
          metrics: {
            totalReturn: 1,
            netProfit: 100,
            maxDrawdown: 2,
            profitFactor: 10,
            winRate: 50,
          },
        }),
        buildSymbolSplit("ETH/USDT", {
          grossProfit: 500,
          grossLoss: 1_000,
          winningTrades: 1,
          losingTrades: 9,
          closedTrades: 10,
          metrics: {
            totalReturn: -5,
            netProfit: -500,
            maxDrawdown: 12,
            profitFactor: 0.5,
            winRate: 10,
          },
        }),
      ],
      "test"
    );

    expect(aggregated.profitFactor).toBe(0.5095);
    expect(aggregated.winRate).toBe(16.6667);
    expect(aggregated.totalTrades).toBe(12);
    expect(aggregated.participatingSymbols).toBe(1);
  });

  it("uses the portfolio equity curve for return, drawdown, and Sharpe", () => {
    const base: AggregateMetrics = {
      totalReturn: -20,
      netProfit: -2_000,
      maxDrawdown: 80,
      sharpeRatio: -4,
      profitFactor: 1.2,
      winRate: 55,
      totalTrades: 40,
      positiveSymbols: 6,
      participatingSymbols: 8,
      symbolCount: 10,
    };
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    const equityCurve = [
      { time: start, equity: 10_000 },
      { time: start + 24 * 60 * 60 * 1000, equity: 10_250 },
      { time: start + 2 * 24 * 60 * 60 * 1000, equity: 10_150 },
      { time: start + 3 * 24 * 60 * 60 * 1000, equity: 10_500 },
    ];
    const drawdownCurve = [
      { time: equityCurve[0]!.time, drawdown: 0 },
      { time: equityCurve[1]!.time, drawdown: 0 },
      { time: equityCurve[2]!.time, drawdown: 0.9756 },
      { time: equityCurve[3]!.time, drawdown: 0 },
    ];

    const metrics = applyPortfolioCurveMetrics(base, equityCurve, drawdownCurve);

    expect(metrics.totalReturn).toBe(5);
    expect(metrics.netProfit).toBe(500);
    expect(metrics.maxDrawdown).toBe(0.9756);
    expect(metrics.sharpeRatio).toBeCloseTo(calculatePortfolioSharpeRatio(equityCurve), 4);
    expect(metrics.sharpeRatio).toBeGreaterThan(0);
  });

  it("adds equal-weight buy-and-hold benchmark context to portfolio metrics", () => {
    const base: AggregateMetrics = {
      totalReturn: 0,
      netProfit: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      profitFactor: 1.4,
      winRate: 60,
      totalTrades: 80,
      positiveSymbols: 7,
      participatingSymbols: 9,
      symbolCount: 10,
    };
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    const strategyCurve = [
      { time: start, equity: 10_000 },
      { time: start + 24 * 60 * 60 * 1000, equity: 10_500 },
    ];
    const benchmarkCurve = [
      { time: start, equity: 10_000 },
      { time: start + 24 * 60 * 60 * 1000, equity: 12_000 },
    ];

    const metrics = applyPortfolioCurveMetrics(
      base,
      strategyCurve,
      [
        { time: strategyCurve[0]!.time, drawdown: 0 },
        { time: strategyCurve[1]!.time, drawdown: 0 },
      ],
      {
        equityCurve: benchmarkCurve,
        drawdownCurve: [
          { time: benchmarkCurve[0]!.time, drawdown: 0 },
          { time: benchmarkCurve[1]!.time, drawdown: 0 },
        ],
      }
    );

    expect(metrics.totalReturn).toBe(5);
    expect(metrics.benchmark?.totalReturn).toBe(20);
    expect(metrics.excessReturn).toBe(-15);
    expect(metrics.drawdownAdvantage).toBe(0);
  });

  it("builds equal-weight portfolio curves on a shared timeline with carry-forward equity", () => {
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    const day = 24 * 60 * 60 * 1000;

    const curve = buildTimeAlignedEqualWeightCurve(
      [
        [
          { time: start, equity: 10_000 },
          { time: start + day, equity: 9_000 },
          { time: start + 10 * day, equity: 11_000 },
        ],
        [
          { time: start, equity: 10_000 },
          { time: start + 10 * day, equity: 20_000 },
        ],
      ],
      10
    );

    expect(curve).toEqual([
      { time: start, equity: 10_000 },
      { time: start + day, equity: 9_500 },
      { time: start + 10 * day, equity: 15_500 },
    ]);
  });

  it("models buy-and-hold benchmark with the same fees and slippage assumptions", () => {
    const candles = [
      { time: 0, open: 100, high: 100, low: 100, close: 100, volume: 1 },
      { time: 86_400_000, open: 120, high: 120, low: 110, close: 120, volume: 1 },
    ];

    const benchmark = runBuyAndHoldBenchmark(candles, true);

    expect(benchmark.totalReturn).toBeGreaterThan(19);
    expect(benchmark.totalReturn).toBeLessThan(20);
    expect(benchmark.equityCurve).toHaveLength(2);
    expect(benchmark.finalBalance).toBeGreaterThan(11_900);
    expect(benchmark.finalBalance).toBeLessThan(12_000);
  });

  it("handles large intraday benchmark curves without overflowing the stack", () => {
    const candles = Array.from({ length: 120_000 }, (_, index) => {
      const close = 100 + (index % 500) * 0.01;
      return {
        time: index * 60_000,
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1,
      };
    });

    const benchmark = runBuyAndHoldBenchmark(candles, true);

    expect(benchmark.equityCurve?.length).toBeLessThanOrEqual(160);
    expect(benchmark.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it("reuses a loaded timeframe dataset across multiple candidate backtests", async () => {
    const symbols = ["BTC/USDT", "ETH/USDT"];
    const reader = new FakeMarketDataReader(symbols);
    const dataset = await loadResearchDataset(reader, "1h", { symbols, timeframes: ["1h"] });
    const candidates = buildResearchCandidates({
      symbols,
      timeframes: ["1h"],
      strategyKeys: ["sma-crossover"],
    }).slice(0, 2);

    const first = await runResearchCandidateOnDataset(candidates[0]!, dataset);
    const second = await runResearchCandidateOnDataset(candidates[1]!, dataset);

    expect(reader.streamCalls).toBe(symbols.length);
    expect(first.symbols).toHaveLength(symbols.length);
    expect(second.symbols).toHaveLength(symbols.length);
    expect(first.candidate.paramHash).not.toBe(second.candidate.paramHash);
  });

  it("normalizes and deduplicates symbol datasets before loading candles", async () => {
    const reader = new FakeMarketDataReader(["BTC/USDT"]);
    const dataset = await loadResearchDataset(reader, "1h", {
      symbols: ["btc/usdt", "BTC/USDT"],
    });

    expect(dataset.symbols.map((row) => row.symbol)).toEqual(["BTC/USDT"]);
    expect(reader.streamCalls).toBe(1);
  });

  it("reuses precomputed split benchmarks across candidates for the same dataset", async () => {
    const symbols = ["BTC/USDT"];
    const reader = new FakeMarketDataReader(symbols);
    const dataset = await loadResearchDataset(reader, "1h", { symbols, timeframes: ["1h"] });
    const candidates = buildResearchCandidates({
      symbols,
      timeframes: ["1h"],
      strategyKeys: ["sma-crossover"],
    }).slice(0, 2);

    const first = await runResearchCandidateOnDataset(candidates[0]!, dataset);
    const second = await runResearchCandidateOnDataset(candidates[1]!, dataset);
    const precomputed = dataset.symbols[0]?.benchmarks?.test;

    expect(precomputed).toBeDefined();
    expect(first.symbols[0]?.splits.test?.benchmark).toBe(precomputed);
    expect(second.symbols[0]?.splits.test?.benchmark).toBe(precomputed);
    expect(first.symbols[0]?.splits.test?.benchmark).toBe(
      second.symbols[0]?.splits.test?.benchmark
    );
  });

  it("can aggregate candidate evidence from separately loaded symbol datasets", async () => {
    const symbols = ["BTC/USDT", "ETH/USDT"];
    const candidate = buildResearchCandidates({
      symbols,
      timeframes: ["1h"],
      strategyKeys: ["sma-crossover"],
    })[0]!;

    const bulkReader = new FakeMarketDataReader(symbols);
    const bulkDataset = await loadResearchDataset(bulkReader, "1h", {
      symbols,
      timeframes: ["1h"],
    });
    const bulkResult = await runResearchCandidateOnDataset(candidate, bulkDataset);

    const symbolReader = new FakeMarketDataReader(symbols);
    const streamedSymbolResults = [];
    for (const symbol of symbols) {
      const symbolDataset = await loadResearchSymbolDataset(
        symbolReader,
        "1h",
        { symbols },
        symbol
      );
      streamedSymbolResults.push(
        await runResearchCandidateOnSymbolDataset(candidate, "binance", "1h", symbolDataset)
      );
    }
    const streamedResult = buildResearchCandidateResult(candidate, streamedSymbolResults);

    expect(symbolReader.streamCalls).toBe(symbols.length);
    expect(streamedResult.symbols.map((row) => row.symbol)).toEqual(symbols);
    expect(streamedResult.testMetrics).toEqual(bulkResult.testMetrics);
    expect(streamedResult.portfolioEquityCurve).toEqual(bulkResult.portfolioEquityCurve);
  });

  it("precomputes only downsampled test benchmark curves for a split dataset", () => {
    const candles = Array.from({ length: 300 }, (_, index) => ({
      time: index * 60_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100 + index * 0.1,
      volume: 1,
    }));
    const split = splitCandles(candles);

    const benchmarks = buildSplitBenchmarks(split);

    expect(benchmarks.train.equityCurve).toBeUndefined();
    expect(benchmarks.validation.equityCurve).toBeUndefined();
    expect(benchmarks.test.equityCurve?.length).toBeLessThanOrEqual(160);
  });
});

function countByStrategy(candidates: Array<{ strategy: string }>) {
  return candidates
    .map((candidate) => candidate.strategy)
    .sort()
    .reduce<Record<string, number>>((counts, strategy) => {
      counts[strategy] = (counts[strategy] ?? 0) + 1;
      return counts;
    }, {});
}

function buildSymbolSplit(
  symbol: string,
  input: {
    grossProfit: number;
    grossLoss: number;
    winningTrades: number;
    losingTrades: number;
    closedTrades: number;
    metrics: Partial<AggregateMetrics>;
  }
) {
  const split: SplitSummary = {
    startTime: "2026-01-01T00:00:00.000Z",
    endTime: "2026-01-02T00:00:00.000Z",
    candleCount: 24,
    finalBalance: 10_000 + (input.metrics.netProfit ?? 0),
    metrics: {
      totalReturn: input.metrics.totalReturn ?? 0,
      cagr: 0,
      netProfit: input.metrics.netProfit ?? 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: input.metrics.maxDrawdown ?? 0,
      maxDrawdownDuration: 0,
      winRate: input.metrics.winRate ?? 0,
      profitFactor: input.metrics.profitFactor ?? 0,
      averageWin: 0,
      averageLoss: 0,
      riskRewardRatio: 0,
      expectancy: 0,
      totalTrades: input.closedTrades,
      avgHoldTime: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
    },
    tradeStats: {
      grossProfit: input.grossProfit,
      grossLoss: input.grossLoss,
      winningTrades: input.winningTrades,
      losingTrades: input.losingTrades,
      closedTrades: input.closedTrades,
    },
  };

  return {
    symbol,
    coverage: {
      earliest: split.startTime,
      latest: split.endTime,
      totalCandles: split.candleCount,
      gapCount: 0,
    },
    candles: split.candleCount,
    splits: { test: split },
  };
}

class FakeMarketDataReader implements MarketDataReader {
  streamCalls = 0;
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
    this.streamCalls++;
    yield this.candlesBySymbol.get(params.symbol) ?? [];
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
