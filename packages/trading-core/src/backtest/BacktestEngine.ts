import { IndicatorCalculator } from "@tb/indicators";
import type { Candle } from "@tb/types";

import { BacktestExchange } from "../exchange/BacktestExchange";
import { MetricsCalculator } from "../metrics/MetricsCalculator";
import { PerformanceTracker } from "../metrics/PerformanceTracker";
import type { BacktestResult } from "../metrics/types";
import { PositionManager } from "../orders/PositionManager";
import { PositionSizer } from "../risk/PositionSizer";
import { RiskManager } from "../risk/RiskManager";
import type { IStrategy, Signal } from "../strategy/IStrategy";
import { StrategyContext, type Logger } from "../strategy/StrategyContext";
import { StrategyRegistry } from "../strategy/StrategyRegistry";

import type { BacktestConfig } from "./BacktestConfig";

/**
 * Event-driven backtesting engine.
 * Feeds historical candles one by one to a strategy, simulating real-time trading.
 */
export class BacktestEngine {
  private config: BacktestConfig;
  private logger: Logger;

  constructor(config: BacktestConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger ?? silentLogger;
  }

  /**
   * Run a backtest with the given candles.
   * Follows the pseudocode from the plan:
   * 1. Create BacktestExchange with initial balance
   * 2. Instantiate strategy
   * 3. Feed candles one by one
   * 4. Process signals through risk management
   * 5. Collect metrics
   */
  async run(candles: Candle[], strategy?: IStrategy): Promise<BacktestResult> {
    const { config } = this;

    // 1. Create BacktestExchange
    const exchange = new BacktestExchange(
      config.initialBalance,
      config.fees,
      config.slippage,
      config.exchange
    );

    // 2. Create supporting components
    const positionManager = new PositionManager();
    const riskManager = new RiskManager(config.riskConfig, config.initialBalance);
    const positionSizer = new PositionSizer(config.riskConfig);
    const tracker = new PerformanceTracker();
    const indicators = new IndicatorCalculator();

    // 3. Create or use provided strategy
    const strat = strategy ?? StrategyRegistry.create(config.strategyName);

    const ctx = new StrategyContext(
      exchange,
      {
        symbol: config.symbol,
        timeframe: config.timeframe,
        strategyParams: config.strategyParams,
      },
      indicators,
      positionManager,
      this.logger
    );

    // 4. Initialize strategy
    await strat.initialize(ctx);

    const windowSize = config.historyWindowSize ?? 500;
    const processedOrderIds = new Set<string>();

    // 5. Feed candles one by one
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i]!;

      // a. Advance exchange time (processes pending orders)
      exchange.advanceTime(candle);

      // b. Sync filled orders with position manager
      const closedOrders = await exchange.fetchClosedOrders();
      for (const order of closedOrders) {
        if (order.status === "closed" && order.filled > 0 && !processedOrderIds.has(order.id)) {
          processedOrderIds.add(order.id);
          positionManager.processFilledOrder(order);
        }
      }

      // c. Update position prices
      positionManager.updatePrice(config.symbol, candle.close);

      // d. Build history window
      const start = Math.max(0, i - windowSize + 1);
      const history = candles.slice(start, i + 1);

      // e. Get signals from strategy
      const signals = await strat.onCandle(candle, history);

      // f. Process each signal through risk management
      for (const signal of signals) {
        await this.processSignal(
          signal,
          exchange,
          positionManager,
          riskManager,
          positionSizer,
          candle
        );
      }

      // g. Track equity
      const equity = exchange.getEquity(config.symbol);
      tracker.record(candle.time, equity);
      riskManager.updatePeakEquity(equity);
    }

    // 6. Cleanup strategy
    await strat.cleanup();

    // 7. Calculate final metrics
    const equityCurve = tracker.getEquityCurve();
    const dailyReturns = tracker.getDailyReturns();
    const trades = positionManager.getClosedTrades();

    const metricsCalc = new MetricsCalculator();
    const metrics = metricsCalc.calculate(trades, equityCurve, dailyReturns, config.initialBalance);

    return {
      strategyName: strat.name,
      symbol: config.symbol,
      timeframe: config.timeframe,
      startDate: config.startDate,
      endDate: config.endDate,
      initialBalance: config.initialBalance,
      finalBalance: tracker.getLastEquity(),
      metrics,
      trades,
      equityCurve,
      drawdownCurve: tracker.getDrawdownCurve(),
    };
  }

  private async processSignal(
    signal: Signal,
    exchange: BacktestExchange,
    positionManager: PositionManager,
    riskManager: RiskManager,
    positionSizer: PositionSizer,
    candle: Candle
  ): Promise<void> {
    const [, quote] = this.config.symbol.split("/") as [string, string];

    if (signal.action === "CLOSE_LONG" || signal.action === "CLOSE_SHORT") {
      const pos = positionManager.getPosition(signal.symbol);
      if (!pos) return;

      const side = signal.action === "CLOSE_SHORT" ? "buy" : "sell";
      try {
        const order = await exchange.createOrder(
          signal.symbol,
          signal.orderType,
          side,
          pos.amount,
          signal.price
        );
        if (order.status === "closed") {
          positionManager.processFilledOrder(order);
        }
      } catch {
        this.logger.warn(`Failed to close position for ${signal.symbol}`);
      }
      return;
    }

    if (signal.action === "NEUTRAL") return;

    // BUY or SELL signal
    const side = signal.action === "BUY" ? "buy" : "sell";
    const balance = await exchange.fetchBalance();
    const equity = exchange.getEquity(this.config.symbol);

    // Determine amount
    let amount = signal.amount;
    if (!amount) {
      amount = positionSizer.calculate(equity, candle.close, signal.stopLoss);
    }

    const orderCost = amount * candle.close;

    // Risk check
    const riskCheck = riskManager.checkOrder(
      orderCost,
      equity,
      positionManager.getPositions(),
      balance,
      quote,
      candle.time
    );

    if (!riskCheck.allowed) {
      this.logger.debug(`Order rejected: ${riskCheck.reason}`);
      return;
    }

    try {
      const order = await exchange.createOrder(
        signal.symbol,
        signal.orderType,
        side,
        amount,
        signal.price
      );
      if (order.status === "closed") {
        positionManager.processFilledOrder(order);
      }
    } catch {
      this.logger.warn(`Failed to create order for ${signal.symbol}`);
    }
  }
}

const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
