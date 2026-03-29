// Exchange
export type {
  IExchange,
  Ticker,
  OrderBook,
  Position,
  TradeRecord,
  FeeConfig,
  SlippageConfig,
} from "./exchange/types.js";
export { BacktestExchange } from "./exchange/BacktestExchange.js";
export { LiveExchange } from "./exchange/LiveExchange.js";
export { PaperExchange } from "./exchange/PaperExchange.js";

// Strategy
export type { IStrategy, Signal, SignalAction } from "./strategy/IStrategy.js";
export { StrategyContext, type StrategyConfig, type Logger } from "./strategy/StrategyContext.js";
export { StrategyRegistry } from "./strategy/StrategyRegistry.js";
export { SMACrossover } from "./strategy/strategies/SMACrossover.js";
export { RSIMeanReversion } from "./strategy/strategies/RSIMeanReversion.js";

// Backtest
export { BacktestEngine } from "./backtest/BacktestEngine.js";
export type { BacktestConfig } from "./backtest/BacktestConfig.js";

// Orders
export { OrderManager } from "./orders/OrderManager.js";
export { PositionManager } from "./orders/PositionManager.js";
export { OrderSimulator } from "./orders/OrderSimulator.js";

// Risk
export {
  RiskManager,
  DEFAULT_RISK_CONFIG,
  type RiskConfig,
  type RiskCheckResult,
} from "./risk/RiskManager.js";
export { PositionSizer } from "./risk/PositionSizer.js";

// Metrics
export { MetricsCalculator } from "./metrics/MetricsCalculator.js";
export { PerformanceTracker } from "./metrics/PerformanceTracker.js";
export type { PerformanceMetrics, EquityPoint, BacktestResult } from "./metrics/types.js";

// Bot
export { Bot, type BotConfig } from "./bot/Bot.js";
export { BotStateMachine, type BotState } from "./bot/BotStateMachine.js";
export { BotRunner } from "./bot/BotRunner.js";

// Utils
export { timeframeToMs, msToTimeframe, candlesInRange } from "./utils/timeframe.js";
export { roundTo, percentChange } from "./utils/decimal.js";
