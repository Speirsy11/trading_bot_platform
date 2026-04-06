// Exchange
export type {
  IExchange,
  Ticker,
  OrderBook,
  Position,
  TradeRecord,
  FeeConfig,
  SlippageConfig,
} from "./exchange/types";
export { BacktestExchange } from "./exchange/BacktestExchange";
export { LiveExchange } from "./exchange/LiveExchange";
export { PaperExchange } from "./exchange/PaperExchange";

// Strategy
export type { IStrategy, Signal, SignalAction } from "./strategy/IStrategy";
export { StrategyContext, type StrategyConfig, type Logger } from "./strategy/StrategyContext";
export { StrategyRegistry } from "./strategy/StrategyRegistry";
export { SMACrossover } from "./strategy/strategies/SMACrossover";
export { RSIMeanReversion } from "./strategy/strategies/RSIMeanReversion";

// Backtest
export { BacktestEngine } from "./backtest/BacktestEngine";
export type { BacktestConfig } from "./backtest/BacktestConfig";

// Orders
export { OrderManager } from "./orders/OrderManager";
export { PositionManager } from "./orders/PositionManager";
export { OrderSimulator } from "./orders/OrderSimulator";

// Risk
export {
  RiskManager,
  DEFAULT_RISK_CONFIG,
  type RiskConfig,
  type RiskCheckResult,
} from "./risk/RiskManager";
export { PositionSizer } from "./risk/PositionSizer";

// Metrics
export { MetricsCalculator } from "./metrics/MetricsCalculator";
export { PerformanceTracker } from "./metrics/PerformanceTracker";
export type { PerformanceMetrics, EquityPoint, BacktestResult } from "./metrics/types";

// Bot
export { Bot, type BotConfig } from "./bot/Bot";
export { BotStateMachine, type BotState } from "./bot/BotStateMachine";
export { BotRunner } from "./bot/BotRunner";

// Utils
export { timeframeToMs, msToTimeframe, candlesInRange } from "./utils/timeframe";
export { roundTo, percentChange } from "./utils/decimal";
