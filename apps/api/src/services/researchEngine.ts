import { createHash } from "node:crypto";

import { MetricsCalculator, type PerformanceMetrics, type TradeRecord } from "@tb/trading-core";
import type { Candle } from "@tb/types";

import type { MarketCoverage, MarketDataReader } from "./harvesterMarketData";
import { getStrategyCatalog } from "./strategyCatalog";

export const RESEARCH_SYMBOLS = [
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "ADA/USDT",
  "XRP/USDT",
  "TRX/USDT",
  "ZEC/USDT",
  "DOGE/USDT",
  "BCH/USDT",
  "SOL/USDT",
] as const;

export const RESEARCH_TIMEFRAMES = ["15m", "1h", "4h"] as const;
export const RESEARCH_STRATEGY_KEYS = [
  "sma-crossover",
  "rsi-mean-reversion",
  "bollinger-long-bounce",
  "donchian-breakout",
  "ema-atr-trend",
] as const;
export const RESEARCH_ENGINE_VERSION = "research-lab-v1.3.4-time-aligned-portfolio";
export const RESEARCH_EXECUTION_DEFAULTS = {
  initialBalance: 10_000,
  fees: { maker: 0.001, taker: 0.001 },
  slippage: { enabled: true, percentage: 0.0005 },
} as const;
export const RESEARCH_EXECUTION_ASSUMPTIONS = {
  marketMode: "spot",
  ...RESEARCH_EXECUTION_DEFAULTS,
} as const;

const INITIAL_BALANCE = RESEARCH_EXECUTION_DEFAULTS.initialBalance;
const FEES = RESEARCH_EXECUTION_DEFAULTS.fees;
const SLIPPAGE = RESEARCH_EXECUTION_DEFAULTS.slippage;
const MIN_TRADES_PER_PARTICIPATING_SYMBOL = 3;
const REQUIRED_RESEARCH_SYMBOL_COUNT = RESEARCH_SYMBOLS.length;
const MIN_PARTICIPATING_SYMBOLS = 6;
const DATASET_LOAD_CONCURRENCY = 3;

export type ResearchSplitName = "train" | "validation" | "test";

export interface ResearchCandidate {
  strategy: string;
  strategyName: string;
  strategyParams: Record<string, unknown>;
  paramHash: string;
  timeframe: string;
}

export interface ResearchSweepOptions {
  exchange?: string;
  symbols?: string[];
  timeframes?: string[];
  strategyKeys?: string[];
  allowFallbackRollups?: boolean;
}

export interface ResearchSymbolSplitResult {
  symbol: string;
  coverage: {
    earliest: string | null;
    latest: string | null;
    totalCandles: number;
    gapCount: number;
  };
  candles: number;
  splits: {
    train?: SplitSummary;
    validation?: SplitSummary;
    test?: SplitSummary;
  };
  error?: string;
}

export interface SplitSummary {
  startTime: string;
  endTime: string;
  candleCount: number;
  finalBalance: number;
  metrics: PerformanceMetrics;
  tradeStats: SplitTradeStats;
  equityCurve?: Array<{ time: number; equity: number }>;
  benchmark?: BenchmarkSummary;
}

export interface SplitTradeStats {
  grossProfit: number;
  grossLoss: number;
  winningTrades: number;
  losingTrades: number;
  closedTrades: number;
}

export interface AggregateMetrics {
  totalReturn: number;
  netProfit: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  winRate: number;
  totalTrades: number;
  positiveSymbols: number;
  participatingSymbols: number;
  symbolCount: number;
  benchmark?: BenchmarkSummary;
  excessReturn?: number;
  drawdownAdvantage?: number;
}

export interface BenchmarkSummary {
  totalReturn: number;
  netProfit: number;
  maxDrawdown: number;
  sharpeRatio: number;
  finalBalance: number;
  equityCurve?: Array<{ time: number; equity: number }>;
  drawdownCurve?: Array<{ time: number; drawdown: number }>;
}

export interface ResearchCandidateResult {
  candidate: ResearchCandidate;
  symbols: ResearchSymbolSplitResult[];
  trainMetrics: AggregateMetrics;
  validationMetrics: AggregateMetrics;
  testMetrics: AggregateMetrics;
  portfolioEquityCurve: Array<{ time: number; equity: number }>;
  drawdownCurve: Array<{ time: number; drawdown: number }>;
  qualified: boolean;
  qualificationReasons: string[];
}

export interface ResearchSymbolDataset {
  symbol: string;
  coverage: ResearchSymbolSplitResult["coverage"];
  candles: Candle[];
  split?: {
    train: Candle[];
    validation: Candle[];
    test: Candle[];
  };
  benchmarks?: {
    train: BenchmarkSummary;
    validation: BenchmarkSummary;
    test: BenchmarkSummary;
  };
  error?: string;
}

export interface ResearchDataset {
  exchange: string;
  timeframe: string;
  symbols: ResearchSymbolDataset[];
}

export function buildResearchCandidates(options: ResearchSweepOptions = {}): ResearchCandidate[] {
  const catalogByKey = new Map(getStrategyCatalog().map((strategy) => [strategy.key, strategy]));
  const strategyKeys = new Set(uniqueStrings(options.strategyKeys ?? [...RESEARCH_STRATEGY_KEYS]));
  const timeframes = uniqueStrings(options.timeframes ?? [...RESEARCH_TIMEFRAMES]);
  const candidates: ResearchCandidate[] = [];

  for (const timeframe of timeframes) {
    for (const params of buildSmaParams()) {
      if (strategyKeys.has("sma-crossover")) {
        candidates.push(makeCandidate(catalogByKey, "sma-crossover", params, timeframe));
      }
    }
    for (const params of buildRsiParams()) {
      if (strategyKeys.has("rsi-mean-reversion")) {
        candidates.push(makeCandidate(catalogByKey, "rsi-mean-reversion", params, timeframe));
      }
    }
    for (const params of buildBollingerParams()) {
      if (strategyKeys.has("bollinger-long-bounce")) {
        candidates.push(makeCandidate(catalogByKey, "bollinger-long-bounce", params, timeframe));
      }
    }
    for (const params of buildDonchianParams()) {
      if (strategyKeys.has("donchian-breakout")) {
        candidates.push(makeCandidate(catalogByKey, "donchian-breakout", params, timeframe));
      }
    }
    for (const params of buildEmaAtrParams()) {
      if (strategyKeys.has("ema-atr-trend")) {
        candidates.push(makeCandidate(catalogByKey, "ema-atr-trend", params, timeframe));
      }
    }
  }

  return candidates;
}

export async function runResearchCandidate(
  marketData: MarketDataReader,
  candidate: ResearchCandidate,
  options: ResearchSweepOptions = {}
): Promise<ResearchCandidateResult> {
  const dataset = await loadResearchDataset(marketData, candidate.timeframe, options);
  return runResearchCandidateOnDataset(candidate, dataset);
}

export async function loadResearchDataset(
  marketData: MarketDataReader,
  timeframe: string,
  options: ResearchSweepOptions = {}
): Promise<ResearchDataset> {
  const exchange = options.exchange ?? "binance";
  const symbols = resolveResearchSymbols(options);
  const symbolDatasets = await mapWithConcurrency(
    symbols,
    DATASET_LOAD_CONCURRENCY,
    async (symbol) => loadResearchSymbolDataset(marketData, timeframe, options, symbol)
  );

  return {
    exchange,
    timeframe,
    symbols: symbolDatasets,
  };
}

export async function loadResearchSymbolDataset(
  marketData: MarketDataReader,
  timeframe: string,
  options: ResearchSweepOptions = {},
  inputSymbol: string
): Promise<ResearchSymbolDataset> {
  const exchange = options.exchange ?? "binance";
  const symbol = normalizeResearchSymbol(inputSymbol);
  const coverage = await marketData.getCoverage(exchange, symbol, timeframe);
  const coverageSummary = serializeCoverage(coverage);

  if (!coverage.earliest || !coverage.latest) {
    return {
      symbol,
      coverage: coverageSummary,
      candles: [],
      error: "No market data coverage available",
    };
  }

  try {
    const candles = await loadCandles(marketData, {
      exchange,
      symbol,
      timeframe,
      startTime: coverage.earliest,
      endTime: coverage.latest,
    });
    const split = splitCandles(candles);
    const benchmarks = buildSplitBenchmarks(split);
    return {
      symbol,
      coverage: coverageSummary,
      candles,
      split,
      benchmarks,
    };
  } catch (error) {
    return {
      symbol,
      coverage: coverageSummary,
      candles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function resolveResearchSymbols(options: ResearchSweepOptions = {}) {
  return uniqueStrings((options.symbols ?? [...RESEARCH_SYMBOLS]).map(normalizeResearchSymbol));
}

export function normalizeResearchSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function uniqueStrings<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

export async function runResearchCandidateOnDataset(
  candidate: ResearchCandidate,
  dataset: ResearchDataset
): Promise<ResearchCandidateResult> {
  if (candidate.timeframe !== dataset.timeframe) {
    throw new Error(
      `Candidate timeframe ${candidate.timeframe} does not match dataset timeframe ${dataset.timeframe}`
    );
  }

  const symbolResults: ResearchSymbolSplitResult[] = [];

  for (const symbolData of dataset.symbols) {
    symbolResults.push(
      await runResearchCandidateOnSymbolDataset(
        candidate,
        dataset.exchange,
        dataset.timeframe,
        symbolData
      )
    );
  }

  return buildResearchCandidateResult(candidate, symbolResults);
}

export async function runResearchCandidateOnSymbolDataset(
  candidate: ResearchCandidate,
  exchange: string,
  timeframe: string,
  symbolData: ResearchSymbolDataset
): Promise<ResearchSymbolSplitResult> {
  if (candidate.timeframe !== timeframe) {
    throw new Error(
      `Candidate timeframe ${candidate.timeframe} does not match dataset timeframe ${timeframe}`
    );
  }

  if (!symbolData.split) {
    return {
      symbol: symbolData.symbol,
      coverage: symbolData.coverage,
      candles: symbolData.candles.length,
      splits: {},
      error: symbolData.error ?? "No split dataset available",
    };
  }

  try {
    const train = await runSplit(
      candidate,
      exchange,
      symbolData.symbol,
      symbolData.split.train,
      false,
      symbolData.benchmarks?.train
    );
    const validation = await runSplit(
      candidate,
      exchange,
      symbolData.symbol,
      symbolData.split.validation,
      false,
      symbolData.benchmarks?.validation
    );
    const test = await runSplit(
      candidate,
      exchange,
      symbolData.symbol,
      symbolData.split.test,
      true,
      symbolData.benchmarks?.test
    );

    return {
      symbol: symbolData.symbol,
      coverage: symbolData.coverage,
      candles: symbolData.candles.length,
      splits: { train, validation, test },
    };
  } catch (error) {
    return {
      symbol: symbolData.symbol,
      coverage: symbolData.coverage,
      candles: symbolData.candles.length,
      splits: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildResearchCandidateResult(
  candidate: ResearchCandidate,
  symbolResults: ResearchSymbolSplitResult[]
): ResearchCandidateResult {
  const trainMetrics = aggregateSplit(symbolResults, "train");
  const validationMetrics = aggregateSplit(symbolResults, "validation");
  const aggregatedTestMetrics = aggregateSplit(symbolResults, "test");
  const portfolioEquityCurve = buildPortfolioEquityCurve(symbolResults);
  const drawdownCurve = buildDrawdownCurve(portfolioEquityCurve);
  const benchmarkEquityCurve = buildPortfolioBenchmarkEquityCurve(symbolResults);
  const benchmarkDrawdownCurve = buildDrawdownCurve(benchmarkEquityCurve);
  const testMetrics = applyPortfolioCurveMetrics(
    aggregatedTestMetrics,
    portfolioEquityCurve,
    drawdownCurve,
    benchmarkEquityCurve.length > 0
      ? {
          equityCurve: benchmarkEquityCurve,
          drawdownCurve: benchmarkDrawdownCurve,
        }
      : undefined
  );
  const qualification = qualifyResearchResult(testMetrics);

  return {
    candidate,
    symbols: symbolResults,
    trainMetrics,
    validationMetrics,
    testMetrics,
    portfolioEquityCurve,
    drawdownCurve,
    qualified: qualification.qualified,
    qualificationReasons: qualification.reasons,
  };
}

export function splitCandles(candles: Candle[]): {
  train: Candle[];
  validation: Candle[];
  test: Candle[];
} {
  if (candles.length < 90) {
    throw new Error(`Need at least 90 candles for chronological split; got ${candles.length}`);
  }

  const trainEnd = Math.max(1, Math.floor(candles.length * 0.7));
  const validationEnd = Math.max(trainEnd + 1, Math.floor(candles.length * 0.85));
  return {
    train: candles.slice(0, trainEnd),
    validation: candles.slice(trainEnd, validationEnd),
    test: candles.slice(validationEnd),
  };
}

export function buildSplitBenchmarks(split: {
  train: Candle[];
  validation: Candle[];
  test: Candle[];
}) {
  return {
    train: runBuyAndHoldBenchmark(split.train),
    validation: runBuyAndHoldBenchmark(split.validation),
    test: runBuyAndHoldBenchmark(split.test, true),
  };
}

export function qualifyResearchResult(metrics: AggregateMetrics) {
  const reasons: string[] = [];
  if (metrics.symbolCount < REQUIRED_RESEARCH_SYMBOL_COUNT) {
    reasons.push(`Fewer than ${REQUIRED_RESEARCH_SYMBOL_COUNT} symbols had complete test coverage`);
  }
  if (metrics.totalReturn <= 0) reasons.push("Out-of-sample return is not positive");
  if (metrics.profitFactor <= 1.05) reasons.push("Profit factor is not above 1.05");
  if (metrics.maxDrawdown > 30) reasons.push("Max drawdown is above 30%");
  if (metrics.totalTrades < 30) reasons.push("Fewer than 30 out-of-sample trades");
  if (metrics.participatingSymbols < MIN_PARTICIPATING_SYMBOLS) {
    reasons.push("Fewer than 6 symbols had non-trivial trade participation");
  }

  return {
    qualified: reasons.length === 0,
    reasons: reasons.length > 0 ? reasons : ["Passed out-of-sample robustness gates"],
  };
}

async function loadCandles(
  marketData: MarketDataReader,
  params: {
    exchange: string;
    symbol: string;
    timeframe: string;
    startTime: Date;
    endTime: Date;
  }
): Promise<Candle[]> {
  const candles: Candle[] = [];
  for await (const batch of marketData.streamCandles(params, 20_000)) {
    candles.push(
      ...batch.map((row) => ({
        time: row.time.getTime(),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
        tradesCount: row.tradesCount ?? undefined,
      }))
    );
  }
  return candles;
}

async function runSplit(
  candidate: ResearchCandidate,
  exchange: string,
  symbol: string,
  candles: Candle[],
  keepCurve: boolean = false,
  benchmark?: BenchmarkSummary
): Promise<SplitSummary> {
  if (candles.length === 0) throw new Error("Cannot run backtest split with no candles");

  const result = runFastSpotSplit(candidate, exchange, symbol, candles);
  return {
    startTime: new Date(candles[0]!.time).toISOString(),
    endTime: new Date(candles[candles.length - 1]!.time).toISOString(),
    candleCount: candles.length,
    finalBalance: result.finalBalance,
    metrics: result.metrics,
    tradeStats: summarizeTrades(result.trades),
    equityCurve: keepCurve ? downsampleCurve(result.equityCurve, 160) : undefined,
    benchmark: benchmark ?? runBuyAndHoldBenchmark(candles, keepCurve),
  };
}

function runFastSpotSplit(
  candidate: ResearchCandidate,
  exchange: string,
  symbol: string,
  candles: Candle[]
) {
  const indicators = buildIndicatorSeries(candidate, candles);
  const trades: TradeRecord[] = [];
  const equityCurve: Array<{ time: number; equity: number }> = [];
  let quoteBalance = INITIAL_BALANCE;
  let position: {
    amount: number;
    entryPrice: number;
    entryTime: number;
    entryFee: number;
    stopLoss?: number;
  } | null = null;

  const closePosition = (candle: Candle, price: number, reason: string) => {
    if (!position) return;
    const fillPrice = applySellSlippage(price);
    const proceeds = position.amount * fillPrice;
    const exitFee = proceeds * FEES.taker;
    const pnl = proceeds - exitFee - position.amount * position.entryPrice - position.entryFee;
    quoteBalance += proceeds - exitFee;
    trades.push({
      id: `research-trade-${trades.length + 1}`,
      orderId: `research-order-${trades.length + 1}`,
      symbol,
      side: "sell",
      type: "market",
      amount: position.amount,
      price: fillPrice,
      cost: proceeds,
      fee: round(position.entryFee + exitFee),
      pnl: round(pnl),
      entryPrice: position.entryPrice,
      exitPrice: fillPrice,
      timestamp: candle.time,
      reason,
    });
    position = null;
  };

  for (let index = 0; index < candles.length; index++) {
    const candle = candles[index]!;

    if (position?.stopLoss && candle.low <= position.stopLoss) {
      closePosition(candle, position.stopLoss, "atr-stop");
    }

    const signal = getResearchSignal(candidate, candles, indicators, index);
    if (signal.action === "buy" && !position && quoteBalance > 0) {
      const fillPrice = applyBuySlippage(candle.close);
      const amount = quoteBalance / (fillPrice * (1 + FEES.taker));
      const cost = amount * fillPrice;
      const fee = cost * FEES.taker;
      quoteBalance -= cost + fee;
      position = {
        amount,
        entryPrice: fillPrice,
        entryTime: candle.time,
        entryFee: fee,
        stopLoss: signal.stopLoss,
      };
    } else if (signal.action === "sell" && position) {
      closePosition(candle, candle.close, signal.reason);
    }

    const equity = quoteBalance + (position ? position.amount * candle.close : 0);
    equityCurve.push({ time: candle.time, equity: round(equity) });
  }

  const lastCandle = candles[candles.length - 1]!;
  if (position) {
    closePosition(lastCandle, lastCandle.close, "end-of-split");
    equityCurve[equityCurve.length - 1] = {
      time: lastCandle.time,
      equity: round(quoteBalance),
    };
  }

  const metrics = new MetricsCalculator().calculate(
    trades,
    equityCurve,
    calculateDailyReturns(equityCurve),
    INITIAL_BALANCE
  );

  return {
    finalBalance: equityCurve.at(-1)?.equity ?? INITIAL_BALANCE,
    metrics,
    trades,
    equityCurve,
    exchange,
  };
}

type ResearchSignal = {
  action?: "buy" | "sell";
  stopLoss?: number;
  reason: string;
};

type IndicatorSeries = {
  close: number[];
  high: number[];
  low: number[];
  smaFast?: number[];
  smaSlow?: number[];
  emaFast?: number[];
  emaSlow?: number[];
  rsi?: number[];
  bbUpper?: number[];
  bbMiddle?: number[];
  bbLower?: number[];
  atr?: number[];
};

function buildIndicatorSeries(candidate: ResearchCandidate, candles: Candle[]): IndicatorSeries {
  const close = candles.map((candle) => candle.close);
  const high = candles.map((candle) => candle.high);
  const low = candles.map((candle) => candle.low);
  const params = candidate.strategyParams;

  switch (candidate.strategy) {
    case "sma-crossover":
      return {
        close,
        high,
        low,
        smaFast: smaAligned(close, numberParam(params, "fastPeriod")),
        smaSlow: smaAligned(close, numberParam(params, "slowPeriod")),
      };
    case "rsi-mean-reversion":
      return {
        close,
        high,
        low,
        rsi: rsiAligned(close, numberParam(params, "rsiPeriod")),
      };
    case "bollinger-long-bounce": {
      const bands = bollingerAligned(
        close,
        numberParam(params, "period"),
        numberParam(params, "stdDevMultiplier")
      );
      return {
        close,
        high,
        low,
        rsi: rsiAligned(close, 14),
        bbUpper: bands.upper,
        bbMiddle: bands.middle,
        bbLower: bands.lower,
      };
    }
    case "donchian-breakout":
      return {
        close,
        high,
        low,
        atr: atrAligned(candles, numberParam(params, "atrPeriod", 14)),
      };
    case "ema-atr-trend":
      return {
        close,
        high,
        low,
        emaFast: emaAligned(close, numberParam(params, "fastPeriod")),
        emaSlow: emaAligned(close, numberParam(params, "slowPeriod")),
        atr: atrAligned(candles, numberParam(params, "atrPeriod", 14)),
      };
    default:
      throw new Error(`Unsupported research strategy: ${candidate.strategy}`);
  }
}

function getResearchSignal(
  candidate: ResearchCandidate,
  candles: Candle[],
  indicators: IndicatorSeries,
  index: number
): ResearchSignal {
  const params = candidate.strategyParams;
  const candle = candles[index]!;

  switch (candidate.strategy) {
    case "sma-crossover": {
      const fast = indicators.smaFast?.[index] ?? Number.NaN;
      const slow = indicators.smaSlow?.[index] ?? Number.NaN;
      const prevFast = indicators.smaFast?.[index - 1] ?? Number.NaN;
      const prevSlow = indicators.smaSlow?.[index - 1] ?? Number.NaN;
      if (![fast, slow, prevFast, prevSlow].every(Number.isFinite)) return { reason: "warmup" };
      if (prevFast <= prevSlow && fast > slow) return { action: "buy", reason: "sma-cross-up" };
      if (prevFast >= prevSlow && fast < slow) return { action: "sell", reason: "sma-cross-down" };
      return { reason: "hold" };
    }
    case "rsi-mean-reversion": {
      const rsi = indicators.rsi?.[index] ?? Number.NaN;
      const prevRsi = indicators.rsi?.[index - 1] ?? Number.NaN;
      if (![rsi, prevRsi].every(Number.isFinite)) return { reason: "warmup" };
      const oversold = numberParam(params, "oversoldLevel");
      const exit = numberParam(params, "overboughtLevel");
      if (prevRsi >= oversold && rsi < oversold) return { action: "buy", reason: "rsi-oversold" };
      if (prevRsi <= exit && rsi > exit) return { action: "sell", reason: "rsi-exit" };
      return { reason: "hold" };
    }
    case "bollinger-long-bounce": {
      const lower = indicators.bbLower?.[index] ?? Number.NaN;
      const middle = indicators.bbMiddle?.[index] ?? Number.NaN;
      const upper = indicators.bbUpper?.[index] ?? Number.NaN;
      const prevLower = indicators.bbLower?.[index - 1] ?? Number.NaN;
      const prevMiddle = indicators.bbMiddle?.[index - 1] ?? Number.NaN;
      const prevUpper = indicators.bbUpper?.[index - 1] ?? Number.NaN;
      const rsi = indicators.rsi?.[index] ?? Number.NaN;
      const prevClose = indicators.close[index - 1] ?? Number.NaN;
      if (
        ![lower, middle, upper, prevLower, prevMiddle, prevUpper, rsi, prevClose].every(
          Number.isFinite
        )
      ) {
        return { reason: "warmup" };
      }

      if (
        prevClose >= prevLower &&
        candle.close < lower &&
        rsi < numberParam(params, "rsiOversold")
      ) {
        return { action: "buy", reason: "bollinger-washout" };
      }

      const exitBand = String(params.exitBand ?? "middle");
      const exit = exitBand === "upper" ? upper : middle;
      const prevExit = exitBand === "upper" ? prevUpper : prevMiddle;
      if (prevClose <= prevExit && candle.close > exit) {
        return { action: "sell", reason: "bollinger-recovery" };
      }
      return { reason: "hold" };
    }
    case "donchian-breakout": {
      const entryPeriod = numberParam(params, "entryPeriod");
      const exitPeriod = numberParam(params, "exitPeriod");
      if (index < Math.max(entryPeriod, exitPeriod, numberParam(params, "atrPeriod", 14))) {
        return { reason: "warmup" };
      }
      const channelHigh = maxWindow(indicators.high, index - entryPeriod, index - 1);
      const channelLow = minWindow(indicators.low, index - exitPeriod, index - 1);
      if (candle.close > channelHigh) {
        const atr = indicators.atr?.[index] ?? 0;
        const atrStop = numberParam(params, "atrStop");
        return {
          action: "buy",
          stopLoss: atr > 0 && atrStop > 0 ? candle.close - atr * atrStop : undefined,
          reason: "donchian-breakout",
        };
      }
      if (candle.close < channelLow) return { action: "sell", reason: "donchian-exit" };
      return { reason: "hold" };
    }
    case "ema-atr-trend": {
      const fast = indicators.emaFast?.[index] ?? Number.NaN;
      const slow = indicators.emaSlow?.[index] ?? Number.NaN;
      const prevFast = indicators.emaFast?.[index - 1] ?? Number.NaN;
      const prevSlow = indicators.emaSlow?.[index - 1] ?? Number.NaN;
      if (![fast, slow, prevFast, prevSlow].every(Number.isFinite)) return { reason: "warmup" };
      if (prevFast <= prevSlow && fast > slow) {
        const atr = indicators.atr?.[index] ?? 0;
        const atrStop = numberParam(params, "atrStop");
        return {
          action: "buy",
          stopLoss: atr > 0 ? candle.close - atr * atrStop : undefined,
          reason: "ema-cross-up",
        };
      }
      if (prevFast >= prevSlow && fast < slow) return { action: "sell", reason: "ema-cross-down" };
      return { reason: "hold" };
    }
    default:
      throw new Error(`Unsupported research strategy: ${candidate.strategy}`);
  }
}

export function aggregateSplit(
  symbolResults: ResearchSymbolSplitResult[],
  split: ResearchSplitName
): AggregateMetrics {
  const summaries = symbolResults
    .map((row) => row.splits[split])
    .filter((summary): summary is SplitSummary => Boolean(summary));
  const symbolCount = summaries.length;
  if (symbolCount === 0) {
    return emptyAggregate();
  }

  const totalTrades = summaries.reduce((sum, row) => sum + row.metrics.totalTrades, 0);
  const tradeStats = summarizeSplitTrades(summaries);
  const positiveSymbols = summaries.filter(
    (row) => row.metrics.totalReturn > 0 && row.metrics.totalTrades > 0
  ).length;
  const participatingSymbols = summaries.filter(
    (row) => row.metrics.totalTrades >= MIN_TRADES_PER_PARTICIPATING_SYMBOL
  ).length;
  const winRate =
    tradeStats.closedTrades > 0 ? (tradeStats.winningTrades / tradeStats.closedTrades) * 100 : 0;
  const profitFactor =
    tradeStats.grossLoss > 0
      ? tradeStats.grossProfit / tradeStats.grossLoss
      : tradeStats.grossProfit > 0
        ? 999
        : 0;

  return {
    totalReturn: round(avg(summaries.map((row) => row.metrics.totalReturn))),
    netProfit: round(summaries.reduce((sum, row) => sum + row.metrics.netProfit, 0)),
    maxDrawdown: round(Math.max(...summaries.map((row) => row.metrics.maxDrawdown))),
    sharpeRatio: round(avgFinite(summaries.map((row) => row.metrics.sharpeRatio))),
    profitFactor: round(profitFactor),
    winRate: round(winRate),
    totalTrades,
    positiveSymbols,
    participatingSymbols,
    symbolCount,
  };
}

function summarizeTrades(trades: TradeRecord[]): SplitTradeStats {
  const closedTrades = trades.filter((trade) => trade.pnl !== 0 || trade.cost > 0);
  const winningTrades = closedTrades.filter((trade) => trade.pnl > 0);
  const losingTrades = closedTrades.filter((trade) => trade.pnl < 0);
  return {
    grossProfit: round(winningTrades.reduce((sum, trade) => sum + trade.pnl, 0)),
    grossLoss: round(Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0))),
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    closedTrades: closedTrades.length,
  };
}

function summarizeSplitTrades(summaries: SplitSummary[]): SplitTradeStats {
  return summaries.reduce<SplitTradeStats>(
    (stats, summary) => ({
      grossProfit: stats.grossProfit + summary.tradeStats.grossProfit,
      grossLoss: stats.grossLoss + summary.tradeStats.grossLoss,
      winningTrades: stats.winningTrades + summary.tradeStats.winningTrades,
      losingTrades: stats.losingTrades + summary.tradeStats.losingTrades,
      closedTrades: stats.closedTrades + summary.tradeStats.closedTrades,
    }),
    {
      grossProfit: 0,
      grossLoss: 0,
      winningTrades: 0,
      losingTrades: 0,
      closedTrades: 0,
    }
  );
}

export function applyPortfolioCurveMetrics(
  metrics: AggregateMetrics,
  equityCurve: Array<{ time: number; equity: number }>,
  drawdownCurve: Array<{ time: number; drawdown: number }>,
  benchmark?: {
    equityCurve: Array<{ time: number; equity: number }>;
    drawdownCurve: Array<{ time: number; drawdown: number }>;
  }
): AggregateMetrics {
  if (equityCurve.length === 0) return metrics;
  const finalEquity = equityCurve[equityCurve.length - 1]!.equity;
  const totalReturn = ((finalEquity - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;
  const benchmarkMetrics =
    benchmark && benchmark.equityCurve.length > 0
      ? summarizeBenchmarkCurve(benchmark.equityCurve, benchmark.drawdownCurve, true)
      : undefined;
  return {
    ...metrics,
    totalReturn: round(totalReturn),
    netProfit: round(finalEquity - INITIAL_BALANCE),
    maxDrawdown: round(maxDrawdownValue(drawdownCurve)),
    sharpeRatio: round(calculatePortfolioSharpeRatio(equityCurve)),
    benchmark: benchmarkMetrics,
    excessReturn: benchmarkMetrics ? round(totalReturn - benchmarkMetrics.totalReturn) : undefined,
    drawdownAdvantage: benchmarkMetrics
      ? round(benchmarkMetrics.maxDrawdown - maxDrawdownValue(drawdownCurve))
      : undefined,
  };
}

export function calculatePortfolioSharpeRatio(
  equityCurve: Array<{ time: number; equity: number }>,
  riskFreeRate = 0.02
) {
  const dailyReturns = calculateDailyReturns(equityCurve);
  if (dailyReturns.length < 2) return 0;

  const mean = avg(dailyReturns);
  const variance =
    dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;

  const annualizedReturn = mean * 252;
  const annualizedStdDev = stdDev * Math.sqrt(252);
  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

function buildPortfolioEquityCurve(
  symbolResults: ResearchSymbolSplitResult[]
): Array<{ time: number; equity: number }> {
  const curves = symbolResults
    .map((row) => row.splits.test?.equityCurve)
    .filter((curve): curve is Array<{ time: number; equity: number }> => Boolean(curve?.length));

  return buildTimeAlignedEqualWeightCurve(curves);
}

function buildPortfolioBenchmarkEquityCurve(
  symbolResults: ResearchSymbolSplitResult[]
): Array<{ time: number; equity: number }> {
  const curves = symbolResults
    .map((row) => row.splits.test?.benchmark?.equityCurve)
    .filter((curve): curve is Array<{ time: number; equity: number }> => Boolean(curve?.length));

  return buildTimeAlignedEqualWeightCurve(curves);
}

export function buildTimeAlignedEqualWeightCurve(
  curves: Array<Array<{ time: number; equity: number }>>,
  maxPoints = 101
): Array<{ time: number; equity: number }> {
  const orderedCurves = curves
    .map((curve) =>
      curve
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.equity))
        .sort((a, b) => a.time - b.time)
    )
    .filter((curve) => curve.length > 0);

  if (orderedCurves.length === 0) return [];

  const timeline = Array.from(
    new Set(orderedCurves.flatMap((curve) => curve.map((point) => point.time)))
  ).sort((a, b) => a - b);
  const cursors = new Array<number>(orderedCurves.length).fill(0);

  const curve = timeline.map((time) => {
    const normalized = orderedCurves.map((symbolCurve, index) => {
      while (
        cursors[index]! + 1 < symbolCurve.length &&
        symbolCurve[cursors[index]! + 1]!.time <= time
      ) {
        cursors[index]! += 1;
      }

      if (time < symbolCurve[0]!.time) return 1;
      return symbolCurve[cursors[index]!]!.equity / INITIAL_BALANCE;
    });

    return {
      time,
      equity: round(avg(normalized) * INITIAL_BALANCE),
    };
  });

  return downsampleCurve(curve, maxPoints);
}

export function runBuyAndHoldBenchmark(candles: Candle[], keepCurve = false): BenchmarkSummary {
  if (candles.length === 0) {
    return {
      totalReturn: 0,
      netProfit: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      finalBalance: INITIAL_BALANCE,
    };
  }

  const firstCandle = candles[0]!;
  const lastCandle = candles[candles.length - 1]!;
  const buyPrice = applyBuySlippage(firstCandle.close);
  const amount = INITIAL_BALANCE / (buyPrice * (1 + FEES.taker));
  const cost = amount * buyPrice;
  const entryFee = cost * FEES.taker;
  const residualQuote = INITIAL_BALANCE - cost - entryFee;
  const equityCurve = candles.map((candle) => ({
    time: candle.time,
    equity: round(residualQuote + amount * candle.close),
  }));
  const sellPrice = applySellSlippage(lastCandle.close);
  const proceeds = amount * sellPrice;
  const exitFee = proceeds * FEES.taker;
  equityCurve[equityCurve.length - 1] = {
    time: lastCandle.time,
    equity: round(residualQuote + proceeds - exitFee),
  };
  const drawdownCurve = buildDrawdownCurve(equityCurve);

  return summarizeBenchmarkCurve(equityCurve, drawdownCurve, keepCurve);
}

function summarizeBenchmarkCurve(
  equityCurve: Array<{ time: number; equity: number }>,
  drawdownCurve: Array<{ time: number; drawdown: number }>,
  keepCurve: boolean
): BenchmarkSummary {
  const finalBalance = equityCurve.at(-1)?.equity ?? INITIAL_BALANCE;
  return {
    totalReturn: round(((finalBalance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100),
    netProfit: round(finalBalance - INITIAL_BALANCE),
    maxDrawdown: round(maxDrawdownValue(drawdownCurve)),
    sharpeRatio: round(calculatePortfolioSharpeRatio(equityCurve)),
    finalBalance: round(finalBalance),
    equityCurve: keepCurve ? downsampleCurve(equityCurve, 160) : undefined,
    drawdownCurve: keepCurve ? downsampleDrawdownCurve(drawdownCurve, 160) : undefined,
  };
}

function buildDrawdownCurve(
  equityCurve: Array<{ time: number; equity: number }>
): Array<{ time: number; drawdown: number }> {
  let peak = 0;
  return equityCurve.map((point) => {
    peak = Math.max(peak, point.equity);
    const drawdown = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    return { time: point.time, drawdown: round(drawdown) };
  });
}

function buildSmaParams() {
  const params: Record<string, unknown>[] = [];
  for (const fastPeriod of [9, 20, 50]) {
    for (const slowPeriod of [21, 50, 100, 200]) {
      if (fastPeriod < slowPeriod) params.push({ fastPeriod, slowPeriod });
    }
  }
  return params;
}

function buildRsiParams() {
  const params: Record<string, unknown>[] = [];
  for (const rsiPeriod of [14, 21]) {
    for (const oversoldLevel of [25, 30, 35]) {
      for (const overboughtLevel of [50, 60, 70]) {
        params.push({ rsiPeriod, oversoldLevel, overboughtLevel });
      }
    }
  }
  return params;
}

function buildBollingerParams() {
  const params: Record<string, unknown>[] = [];
  for (const period of [20, 30]) {
    for (const stdDevMultiplier of [2, 2.5]) {
      for (const rsiOversold of [30, 35]) {
        for (const exitBand of ["middle", "upper"]) {
          params.push({ period, stdDevMultiplier, rsiOversold, exitBand });
        }
      }
    }
  }
  return params;
}

function buildDonchianParams() {
  const params: Record<string, unknown>[] = [];
  for (const entryPeriod of [20, 55]) {
    for (const exitPeriod of [10, 20]) {
      for (const atrStop of [0, 2, 3]) {
        if (exitPeriod < entryPeriod) params.push({ entryPeriod, exitPeriod, atrStop });
      }
    }
  }
  return params;
}

function buildEmaAtrParams() {
  const params: Record<string, unknown>[] = [];
  for (const fastPeriod of [12, 20]) {
    for (const slowPeriod of [50, 100]) {
      for (const atrStop of [2, 3]) {
        params.push({ fastPeriod, slowPeriod, atrStop });
      }
    }
  }
  return params;
}

function makeCandidate(
  catalogByKey: Map<string, { key: string; name: string }>,
  strategy: string,
  strategyParams: Record<string, unknown>,
  timeframe: string
): ResearchCandidate {
  return {
    strategy,
    strategyName: catalogByKey.get(strategy)?.name ?? strategy,
    strategyParams,
    paramHash: hashParams({ strategy, strategyParams, timeframe }),
    timeframe,
  };
}

function serializeCoverage(coverage: MarketCoverage) {
  return {
    earliest: coverage.earliest?.toISOString() ?? null,
    latest: coverage.latest?.toISOString() ?? null,
    totalCandles: coverage.totalCandles,
    gapCount: coverage.gapCount,
  };
}

function downsampleCurve(
  curve: Array<{ time: number; equity: number }>,
  maxPoints: number
): Array<{ time: number; equity: number }> {
  if (curve.length <= maxPoints) return curve;
  return Array.from({ length: maxPoints }, (_, index) => {
    const curveIndex = Math.min(
      curve.length - 1,
      Math.round((index / (maxPoints - 1)) * (curve.length - 1))
    );
    return curve[curveIndex]!;
  });
}

function downsampleDrawdownCurve(
  curve: Array<{ time: number; drawdown: number }>,
  maxPoints: number
): Array<{ time: number; drawdown: number }> {
  if (curve.length <= maxPoints) return curve;
  return Array.from({ length: maxPoints }, (_, index) => {
    const curveIndex = Math.min(
      curve.length - 1,
      Math.round((index / (maxPoints - 1)) * (curve.length - 1))
    );
    return curve[curveIndex]!;
  });
}

function maxDrawdownValue(curve: Array<{ drawdown: number }>) {
  return curve.reduce((max, point) => Math.max(max, point.drawdown), 0);
}

function calculateDailyReturns(equityCurve: Array<{ time: number; equity: number }>): number[] {
  if (equityCurve.length < 2) return [];
  const returns: number[] = [];
  let currentDay = new Date(equityCurve[0]!.time).toISOString().slice(0, 10);
  let previousDayClose = equityCurve[0]!.equity;
  let latestEquity = equityCurve[0]!.equity;

  for (const point of equityCurve.slice(1)) {
    const day = new Date(point.time).toISOString().slice(0, 10);
    if (day !== currentDay) {
      if (previousDayClose > 0) {
        returns.push((latestEquity - previousDayClose) / previousDayClose);
      }
      previousDayClose = latestEquity;
      currentDay = day;
    }
    latestEquity = point.equity;
  }

  if (previousDayClose > 0) {
    returns.push((latestEquity - previousDayClose) / previousDayClose);
  }

  return returns;
}

function smaAligned(values: number[], period: number): number[] {
  const result = Array(values.length).fill(Number.NaN) as number[];
  if (values.length < period) return result;
  let sum = 0;
  for (let index = 0; index < values.length; index++) {
    sum += values[index]!;
    if (index >= period) sum -= values[index - period]!;
    if (index >= period - 1) result[index] = sum / period;
  }
  return result;
}

function emaAligned(values: number[], period: number): number[] {
  const result = Array(values.length).fill(Number.NaN) as number[];
  if (values.length < period) return result;
  let sum = 0;
  for (let index = 0; index < period; index++) sum += values[index]!;
  let previous = sum / period;
  result[period - 1] = previous;
  const multiplier = 2 / (period + 1);
  for (let index = period; index < values.length; index++) {
    previous = (values[index]! - previous) * multiplier + previous;
    result[index] = previous;
  }
  return result;
}

function rsiAligned(values: number[], period: number): number[] {
  const result = Array(values.length).fill(Number.NaN) as number[];
  if (values.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let index = 1; index <= period; index++) {
    const change = values[index]! - values[index - 1]!;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = rsiFromAverages(avgGain, avgLoss);

  for (let index = period + 1; index < values.length; index++) {
    const change = values[index]! - values[index - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[index] = rsiFromAverages(avgGain, avgLoss);
  }

  return result;
}

function rsiFromAverages(avgGain: number, avgLoss: number) {
  if (avgGain === 0 && avgLoss === 0) return 50;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function bollingerAligned(values: number[], period: number, stdDevMultiplier: number) {
  const middle = smaAligned(values, period);
  const upper = Array(values.length).fill(Number.NaN) as number[];
  const lower = Array(values.length).fill(Number.NaN) as number[];

  for (let index = period - 1; index < values.length; index++) {
    const average = middle[index]!;
    let sumSq = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor++) {
      const diff = values[cursor]! - average;
      sumSq += diff * diff;
    }
    const stdDev = Math.sqrt(sumSq / period);
    upper[index] = average + stdDevMultiplier * stdDev;
    lower[index] = average - stdDevMultiplier * stdDev;
  }

  return { upper, middle, lower };
}

function atrAligned(candles: Candle[], period: number): number[] {
  const result = Array(candles.length).fill(Number.NaN) as number[];
  if (candles.length < period + 1) return result;

  const trueRanges: number[] = [];
  for (let index = 1; index < candles.length; index++) {
    const candle = candles[index]!;
    const previous = candles[index - 1]!;
    trueRanges.push(
      Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previous.close),
        Math.abs(candle.low - previous.close)
      )
    );
  }

  let previousAtr = 0;
  for (let index = 0; index < period; index++) previousAtr += trueRanges[index]!;
  previousAtr /= period;
  result[period] = previousAtr;

  for (let index = period + 1; index < candles.length; index++) {
    previousAtr = (previousAtr * (period - 1) + trueRanges[index - 1]!) / period;
    result[index] = previousAtr;
  }

  return result;
}

function maxWindow(values: number[], start: number, end: number) {
  let max = -Infinity;
  for (let index = Math.max(0, start); index <= end; index++) {
    max = Math.max(max, values[index] ?? -Infinity);
  }
  return max;
}

function minWindow(values: number[], start: number, end: number) {
  let min = Infinity;
  for (let index = Math.max(0, start); index <= end; index++) {
    min = Math.min(min, values[index] ?? Infinity);
  }
  return min;
}

function numberParam(params: Record<string, unknown>, key: string, fallback?: number) {
  const value = params[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Research candidate is missing numeric parameter: ${key}`);
}

function applyBuySlippage(price: number) {
  return SLIPPAGE.enabled ? price * (1 + SLIPPAGE.percentage) : price;
}

function applySellSlippage(price: number) {
  return SLIPPAGE.enabled ? price * (1 - SLIPPAGE.percentage) : price;
}

function hashParams(value: unknown) {
  return createHash("sha1").update(stableStringify(value)).digest("hex").slice(0, 12);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}

function emptyAggregate(): AggregateMetrics {
  return {
    totalReturn: 0,
    netProfit: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    profitFactor: 0,
    winRate: 0,
    totalTrades: 0,
    positiveSymbols: 0,
    participatingSymbols: 0,
    symbolCount: 0,
  };
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function avgFinite(values: number[]) {
  const finite = values.filter(Number.isFinite);
  return finite.length > 0 ? avg(finite) : 0;
}

function round(value: number) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 10_000) / 10_000;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
