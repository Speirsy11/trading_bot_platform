import type { RiskConfig } from "../risk/RiskManager.js";

/**
 * Configuration for a backtest run.
 */
export interface BacktestConfig {
  /** Name of the registered strategy to use. */
  strategyName: string;
  /** Parameters passed to the strategy's `initialize` method. */
  strategyParams: Record<string, unknown>;
  /** Exchange identifier (e.g. "binance", "backtest"). */
  exchange: string;
  /** Trading pair symbol (e.g. "BTC/USDT"). */
  symbol: string;
  /** Candle timeframe (e.g. "1m", "1h", "1d"). */
  timeframe: string;
  /** Backtest start timestamp in milliseconds. */
  startDate: number;
  /** Backtest end timestamp in milliseconds. */
  endDate: number;
  /** Starting portfolio balance in quote currency. */
  initialBalance: number;
  /** Trading fee configuration. */
  fees: {
    /** Fee rate for limit (maker) orders. */
    maker: number;
    /** Fee rate for market (taker) orders. */
    taker: number;
  };
  /** Simulated slippage configuration. */
  slippage: {
    /** Whether slippage simulation is enabled. */
    enabled: boolean;
    /** Slippage as a fraction of fill price (e.g. 0.0005 = 0.05%). */
    percentage: number;
  };
  /** Risk management configuration. */
  riskConfig: RiskConfig;
  /** Number of historical candles to pass to the strategy (default: 500). */
  historyWindowSize?: number;
}
