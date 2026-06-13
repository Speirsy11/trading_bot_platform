import { backtestTrades, backtests, type Database } from "@tb/db";
import { BacktestEngine, DEFAULT_RISK_CONFIG } from "@tb/trading-core";
import type { Candle } from "@tb/types";
import { Worker } from "bullmq";
import { and, eq } from "drizzle-orm";
import type IORedis from "ioredis";

import { API_QUEUE_NAMES, BACKTEST_JOB_NAMES, type BacktestJobData } from "../queues/types";
import type { MarketDataReader } from "../services/harvesterMarketData";
import { bootstrapStrategies } from "../services/strategyCatalog";
import { parseJsonValue, toNumber } from "../utils/serialization";

type FeeConfig = { maker: number; taker: number };
type SlippageConfig = { enabled: boolean; percentage: number };

export type BacktestBenchmarkSummary = {
  totalReturn: number;
  netProfit: number;
  maxDrawdown: number;
  finalBalance: number;
  equityCurve: Array<{ time: number; equity: number }>;
  drawdownCurve: Array<{ time: number; drawdown: number }>;
};

export function createBacktestWorker(options: {
  db: Database;
  redis: IORedis;
  marketData: MarketDataReader;
}) {
  bootstrapStrategies();

  return new Worker<BacktestJobData>(
    API_QUEUE_NAMES.BACKTEST,
    async (job) => {
      if (job.name !== BACKTEST_JOB_NAMES.RUN) {
        return null;
      }

      const backtest = (
        await options.db
          .select()
          .from(backtests)
          .where(eq(backtests.id, job.data.backtestId))
          .limit(1)
      )[0];
      if (!backtest) {
        throw new Error(`Backtest ${job.data.backtestId} not found`);
      }

      try {
        const transition = await options.db
          .update(backtests)
          .set({ status: "running", error: null })
          .where(and(eq(backtests.id, backtest.id), eq(backtests.status, "pending")))
          .returning({ id: backtests.id });

        if (transition.length === 0) {
          throw new Error(`Backtest ${backtest.id} is no longer pending`);
        }

        await options.redis.publish(
          "backtest:progress",
          JSON.stringify({
            backtestId: backtest.id,
            progress: 5,
            currentDate: backtest.startTime.getTime(),
          })
        );

        const candles = await loadBacktestCandles(options.marketData, {
          exchange: backtest.exchange,
          symbol: backtest.symbol,
          timeframe: backtest.timeframe,
          startTime: backtest.startTime,
          endTime: backtest.endTime,
        });

        const config = parseJsonValue<Record<string, unknown>>(backtest.metrics, {});
        const fees = parseJsonValue<FeeConfig>(config["fees"], { maker: 0.001, taker: 0.001 });
        const slippage = parseJsonValue<SlippageConfig>(config["slippage"], {
          enabled: true,
          percentage: 0.0005,
        });
        const initialBalance = toNumber(backtest.initialBalance);
        const engine = new BacktestEngine({
          strategyName: backtest.strategy,
          strategyParams: parseJsonValue(backtest.strategyParams, {}),
          exchange: backtest.exchange,
          symbol: backtest.symbol,
          timeframe: backtest.timeframe,
          startDate: backtest.startTime.getTime(),
          endDate: backtest.endTime.getTime(),
          initialBalance,
          marketMode: "spot",
          riskConfig: parseJsonValue(backtest.riskConfig, DEFAULT_RISK_CONFIG),
          fees,
          slippage,
        });

        const result = await engine.run(candles);
        const benchmark = buildBacktestBuyAndHoldBenchmark(candles, initialBalance, fees, slippage);
        const resultWithBenchmark = {
          ...result,
          benchmark,
          excessReturn: round(result.metrics.totalReturn - benchmark.totalReturn),
          drawdownAdvantage: round(benchmark.maxDrawdown - result.metrics.maxDrawdown),
        };

        const wins = result.trades.filter((trade) => trade.pnl > 0).length;
        const losses = result.trades.filter((trade) => trade.pnl < 0).length;

        await options.db.transaction(async (tx) => {
          await tx.delete(backtestTrades).where(eq(backtestTrades.backtestId, backtest.id));

          if (result.trades.length > 0) {
            await tx.insert(backtestTrades).values(
              result.trades.map((trade) => ({
                backtestId: backtest.id,
                symbol: trade.symbol,
                side: trade.side,
                type: trade.type,
                amount: trade.amount.toString(),
                price: trade.price.toString(),
                cost: trade.cost.toString(),
                fee: trade.fee.toString(),
                pnl: trade.pnl.toString(),
                pnlPercent: undefined,
                balance: undefined,
                reason: trade.reason,
                executedAt: new Date(trade.timestamp),
              }))
            );
          }

          await tx
            .update(backtests)
            .set({
              status: "completed",
              finalBalance: result.finalBalance.toString(),
              totalPnl: result.metrics.netProfit.toString(),
              totalPnlPercent: result.metrics.totalReturn.toString(),
              totalTrades: result.metrics.totalTrades,
              winningTrades: wins,
              losingTrades: losses,
              winRate: result.metrics.winRate.toString(),
              maxDrawdown: result.metrics.maxDrawdown.toString(),
              sharpeRatio: result.metrics.sharpeRatio.toString(),
              profitFactor: result.metrics.profitFactor.toString(),
              metrics: {
                ...config,
                result: resultWithBenchmark,
              },
              completedAt: new Date(),
              error: null,
            })
            .where(eq(backtests.id, backtest.id));
        });

        await job.updateProgress({ progress: 100, currentDate: backtest.endTime.getTime() });
        await options.redis.publish(
          "backtest:progress",
          JSON.stringify({
            backtestId: backtest.id,
            progress: 100,
            currentDate: backtest.endTime.getTime(),
          })
        );
        return { backtestId: backtest.id, status: "completed" };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await options.db
          .update(backtests)
          .set({ status: "failed", error: message, completedAt: new Date() })
          .where(eq(backtests.id, backtest.id));
        await options.redis.publish(
          "worker:error",
          JSON.stringify({
            scope: "backtest",
            backtestId: backtest.id,
            message,
            timestamp: Date.now(),
          })
        );
        throw error;
      }
    },
    {
      connection: options.redis.duplicate({ maxRetriesPerRequest: null }),
      concurrency: 2,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );
}

export function buildBacktestBuyAndHoldBenchmark(
  candles: Candle[],
  initialBalance: number,
  fees: FeeConfig,
  slippage: SlippageConfig
): BacktestBenchmarkSummary {
  if (candles.length === 0 || initialBalance <= 0) {
    return {
      totalReturn: 0,
      netProfit: 0,
      maxDrawdown: 0,
      finalBalance: initialBalance,
      equityCurve: [],
      drawdownCurve: [],
    };
  }

  const firstCandle = candles[0]!;
  const lastCandle = candles[candles.length - 1]!;
  const buyPrice = applySlippage(firstCandle.close, "buy", slippage);
  const amount = initialBalance / (buyPrice * (1 + fees.taker));
  const cost = amount * buyPrice;
  const entryFee = cost * fees.taker;
  const residualQuote = initialBalance - cost - entryFee;
  const fullEquityCurve = candles.map((candle) => ({
    time: candle.time,
    equity: round(residualQuote + amount * candle.close),
  }));
  const sellPrice = applySlippage(lastCandle.close, "sell", slippage);
  const proceeds = amount * sellPrice;
  const exitFee = proceeds * fees.taker;
  fullEquityCurve[fullEquityCurve.length - 1] = {
    time: lastCandle.time,
    equity: round(residualQuote + proceeds - exitFee),
  };
  const fullDrawdownCurve = buildBenchmarkDrawdownCurve(fullEquityCurve);
  const finalBalance = fullEquityCurve.at(-1)?.equity ?? initialBalance;

  return {
    totalReturn: round(((finalBalance - initialBalance) / initialBalance) * 100),
    netProfit: round(finalBalance - initialBalance),
    maxDrawdown: round(fullDrawdownCurve.reduce((max, point) => Math.max(max, point.drawdown), 0)),
    finalBalance: round(finalBalance),
    equityCurve: downsampleCurve(fullEquityCurve, 1000),
    drawdownCurve: downsampleCurve(fullDrawdownCurve, 1000),
  };
}

function applySlippage(price: number, side: "buy" | "sell", slippage: SlippageConfig) {
  if (!slippage.enabled) return price;
  const adjustment = side === "buy" ? 1 + slippage.percentage : 1 - slippage.percentage;
  return price * adjustment;
}

function buildBenchmarkDrawdownCurve(equityCurve: Array<{ time: number; equity: number }>) {
  let peak = 0;
  return equityCurve.map((point) => {
    peak = Math.max(peak, point.equity);
    const drawdown = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    return { time: point.time, drawdown: round(drawdown) };
  });
}

function downsampleCurve<T>(curve: T[], maxPoints: number): T[] {
  if (curve.length <= maxPoints) return curve;
  const step = (curve.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => curve[Math.round(index * step)]!);
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function loadBacktestCandles(
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
        open: toNumber(row.open),
        high: toNumber(row.high),
        low: toNumber(row.low),
        close: toNumber(row.close),
        volume: toNumber(row.volume),
        tradesCount: row.tradesCount ?? undefined,
      }))
    );
  }
  return candles;
}
