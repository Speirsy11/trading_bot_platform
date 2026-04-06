import type { IndicatorCalculator } from "@tb/indicators";
import type { Balance, Order } from "@tb/types";

import type { IExchange, Position } from "../exchange/types";
import type { PositionManager } from "../orders/PositionManager";

export interface StrategyConfig {
  symbol: string;
  timeframe: string;
  strategyParams: Record<string, unknown>;
}

export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
}

/**
 * Context object passed to strategies.
 * Provides access to exchange, indicators, config, and convenience helpers.
 */
export class StrategyContext {
  readonly exchange: IExchange;
  readonly config: StrategyConfig;
  readonly indicators: IndicatorCalculator;
  readonly logger: Logger;
  private positionManager: PositionManager;

  constructor(
    exchange: IExchange,
    config: StrategyConfig,
    indicators: IndicatorCalculator,
    positionManager: PositionManager,
    logger?: Logger
  ) {
    this.exchange = exchange;
    this.config = config;
    this.indicators = indicators;
    this.positionManager = positionManager;
    this.logger = logger ?? consoleLogger;
  }

  async getBalance(): Promise<Balance> {
    return this.exchange.fetchBalance();
  }

  getPositions(): Position[] {
    return this.positionManager.getPositions();
  }

  async getOpenOrders(): Promise<Order[]> {
    return this.exchange.fetchOpenOrders(this.config.symbol);
  }
}

const consoleLogger: Logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data ?? ""),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data ?? ""),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data ?? ""),
  debug: (msg, data) => console.debug(`[DEBUG] ${msg}`, data ?? ""),
};
