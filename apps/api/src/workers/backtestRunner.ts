import { backtestTrades, backtests, queryOHLCVByRange, type Database } from "@tb/db";
import { BacktestEngine, DEFAULT_RISK_CONFIG } from "@tb/trading-core";
import { Worker } from "bullmq";
import { and, eq } from "drizzle-orm";
import type IORedis from "ioredis";

import { API_QUEUE_NAMES, BACKTEST_JOB_NAMES, type BacktestJobData } from "../queues/types.js";
import { bootstrapStrategies } from "../services/strategyCatalog.js";
import { parseJsonValue, toNumber } from "../utils/serialization.js";

export function createBacktestWorker(options: { db: Database; redis: IORedis }) {
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

        const candleRows = await queryOHLCVByRange(
          options.db,
          backtest.exchange,
          backtest.symbol,
          backtest.timeframe,
          backtest.startTime,
          backtest.endTime
        );

        const candles = candleRows.map((row) => ({
          time: row.time.getTime(),
          open: toNumber(row.open),
          high: toNumber(row.high),
          low: toNumber(row.low),
          close: toNumber(row.close),
          volume: toNumber(row.volume),
          tradesCount: row.tradesCount ?? undefined,
        }));

        const config = parseJsonValue<Record<string, unknown>>(backtest.metrics, {});
        const engine = new BacktestEngine({
          strategyName: backtest.strategy,
          strategyParams: parseJsonValue(backtest.strategyParams, {}),
          exchange: backtest.exchange,
          symbol: backtest.symbol,
          timeframe: backtest.timeframe,
          startDate: backtest.startTime.getTime(),
          endDate: backtest.endTime.getTime(),
          initialBalance: toNumber(backtest.initialBalance),
          riskConfig: parseJsonValue(backtest.riskConfig, DEFAULT_RISK_CONFIG),
          fees: parseJsonValue(config["fees"], { maker: 0.001, taker: 0.001 }),
          slippage: parseJsonValue(config["slippage"], { enabled: true, percentage: 0.0005 }),
        });

        const result = await engine.run(candles);

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
                result,
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
    }
  );
}
