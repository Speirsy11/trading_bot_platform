import { IndicatorCalculator } from "@tb/indicators";
import type { Candle, Order } from "@tb/types";

import type { StrategyContextProvider } from "../context/types";
import type { IExchange, TradeRecord } from "../exchange/types";
import { PositionManager } from "../orders/PositionManager";
import { PositionSizer } from "../risk/PositionSizer";
import { RiskManager, type RiskConfig, DEFAULT_RISK_CONFIG } from "../risk/RiskManager";
import type { IStrategy, Signal } from "../strategy/IStrategy";
import { StrategyContext, type Logger } from "../strategy/StrategyContext";

import { BotStateMachine, type BotState } from "./BotStateMachine";

export interface BotOrderFill {
  order: Order;
  trade: TradeRecord | null;
  signal?: Signal;
  candle?: Candle;
  reason: string;
}

export interface BotConfig {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  strategyParams: Record<string, unknown>;
  riskConfig?: RiskConfig;
  marketMode?: "spot" | "margin";
  fees?: { maker: number; taker: number };
  slippage?: { enabled: boolean; percentage: number };
  closePositionsOnStop?: boolean;
  contextProvider?: StrategyContextProvider;
  onOrderFilled?: (fill: BotOrderFill) => void | Promise<void>;
}

/**
 * Bot class: wraps a strategy + exchange, manages execution lifecycle.
 */
export class Bot {
  readonly id: string;
  readonly name: string;
  readonly config: BotConfig;

  private strategy: IStrategy;
  private exchange: IExchange;
  private stateMachine: BotStateMachine;
  private positionManager: PositionManager;
  private riskManager: RiskManager;
  private positionSizer: PositionSizer;
  private indicators: IndicatorCalculator;
  private logger: Logger;
  private marketMode: "spot" | "margin";
  private fees: { maker: number; taker: number };
  private slippage: { enabled: boolean; percentage: number };
  private candleHistory: Candle[] = [];
  private maxHistory = 500;

  constructor(config: BotConfig, strategy: IStrategy, exchange: IExchange, logger?: Logger) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    this.strategy = strategy;
    this.exchange = exchange;
    this.stateMachine = new BotStateMachine();
    this.positionManager = new PositionManager();
    this.indicators = new IndicatorCalculator();
    const riskConfig = config.riskConfig ?? DEFAULT_RISK_CONFIG;
    this.riskManager = new RiskManager(riskConfig, 0);
    this.positionSizer = new PositionSizer(riskConfig);
    this.logger = logger ?? defaultLogger;
    this.marketMode = config.marketMode ?? "spot";
    this.fees = config.fees ?? { maker: 0.001, taker: 0.001 };
    this.slippage = config.slippage ?? { enabled: true, percentage: 0.0005 };
  }

  getState(): BotState {
    return this.stateMachine.getState();
  }

  async start(): Promise<void> {
    const ctx = new StrategyContext(
      this.exchange,
      {
        symbol: this.config.symbol,
        timeframe: this.config.timeframe,
        strategyParams: this.config.strategyParams,
      },
      this.indicators,
      this.positionManager,
      this.logger,
      this.config.contextProvider
    );

    await this.strategy.initialize(ctx);
    this.stateMachine.transition("start");
    this.logger.info(`Bot "${this.name}" started`);
  }

  async processCandle(candle: Candle): Promise<Signal[]> {
    if (!this.stateMachine.isRunning()) {
      return [];
    }

    this.candleHistory.push(candle);
    if (this.candleHistory.length > this.maxHistory) {
      this.candleHistory.shift();
    }

    this.positionManager.updatePrice(this.config.symbol, candle.close);

    try {
      const signals = await this.strategy.onCandle(candle, this.candleHistory);

      for (const signal of signals) {
        await this.executeSignal(signal, candle);
      }

      return signals;
    } catch (err) {
      this.logger.error(`Strategy error: ${String(err)}`);
      this.stateMachine.transition("error");
      return [];
    }
  }

  async pause(): Promise<void> {
    this.stateMachine.transition("pause");
    this.logger.info(`Bot "${this.name}" paused`);
  }

  async resume(): Promise<void> {
    this.stateMachine.transition("resume");
    this.logger.info(`Bot "${this.name}" resumed`);
  }

  async stop(): Promise<void> {
    this.stateMachine.transition("stop");

    // Cancel all pending orders
    const openOrders = await this.exchange.fetchOpenOrders(this.config.symbol);
    for (const order of openOrders) {
      try {
        await this.exchange.cancelOrder(order.id, this.config.symbol);
      } catch {
        this.logger.warn(`Failed to cancel order ${order.id}`);
      }
    }

    // Optionally close positions
    if (this.config.closePositionsOnStop) {
      const pos = this.positionManager.getPosition(this.config.symbol);
      if (pos) {
        const closeSide = pos.side === "short" ? "buy" : "sell";
        try {
          const order = await this.exchange.createOrder(
            this.config.symbol,
            "market",
            closeSide,
            pos.amount
          );
          await this.recordFilledOrder(order, { reason: "stop-close" });
        } catch {
          this.logger.warn("Failed to close position on stop");
        }
      }
    }

    await this.strategy.cleanup();
    this.stateMachine.transition("stopped");
    this.logger.info(`Bot "${this.name}" stopped`);
  }

  private async executeSignal(signal: Signal, candle: Candle): Promise<void> {
    const parts = this.config.symbol.split("/");
    const quote = parts[1] ?? "USDT";

    if (signal.action === "CLOSE_LONG" || signal.action === "CLOSE_SHORT") {
      if (this.marketMode !== "margin" && signal.action === "CLOSE_SHORT") {
        this.logger.debug("Short close ignored in spot market mode");
        return;
      }

      const pos = this.positionManager.getPosition(signal.symbol);
      if (!pos) return;
      const closeSide = signal.action === "CLOSE_SHORT" ? "buy" : "sell";
      try {
        const order = await this.exchange.createOrder(
          signal.symbol,
          signal.orderType,
          closeSide,
          pos.amount,
          signal.price
        );
        await this.recordFilledOrder(order, { signal, candle, reason: signal.reason ?? "close" });
      } catch {
        this.logger.warn(`Failed to close position for ${signal.symbol}`);
      }
      return;
    }

    if (signal.action === "NEUTRAL") return;

    if (this.marketMode !== "margin" && signal.action === "SELL") {
      const pos = this.positionManager.getPosition(signal.symbol);
      if (!pos || pos.side !== "long") {
        this.logger.debug("Short entry rejected in spot market mode");
        return;
      }

      try {
        const order = await this.exchange.createOrder(
          signal.symbol,
          signal.orderType,
          "sell",
          pos.amount,
          signal.price
        );
        await this.recordFilledOrder(order, {
          signal,
          candle,
          reason: signal.reason ?? "spot-exit",
        });
      } catch {
        this.logger.warn(`Failed to close spot position for ${signal.symbol}`);
      }
      return;
    }

    const side = signal.action === "BUY" ? ("buy" as const) : ("sell" as const);
    const balance = await this.exchange.fetchBalance();
    const freeQuote = balance.free[quote] ?? 0;
    const baseBalance = balance.free[this.config.symbol.split("/")[0] ?? ""] ?? 0;
    const equity = freeQuote + baseBalance * candle.close;

    let amount = signal.amount;
    if (!amount) {
      if (this.marketMode === "spot" && signal.action === "BUY") {
        const feeRate = signal.orderType === "limit" ? this.fees.maker : this.fees.taker;
        const referencePrice = signal.price ?? candle.close;
        const estimatedFillPrice =
          referencePrice * (this.slippage.enabled ? 1 + this.slippage.percentage : 1);
        amount = freeQuote / (estimatedFillPrice * (1 + feeRate));
      } else {
        amount = this.positionSizer.calculate(equity, candle.close, signal.stopLoss);
      }
    }

    if (amount <= 0) return;

    const orderCost = amount * candle.close;
    const riskCheck =
      this.marketMode === "spot" && signal.action === "BUY"
        ? { allowed: true }
        : this.riskManager.checkOrder(
            orderCost,
            equity,
            this.positionManager.getPositions(),
            balance,
            quote,
            candle.time
          );

    if (!riskCheck.allowed) {
      this.logger.debug(`Order rejected: ${riskCheck.reason}`);
      return;
    }

    try {
      const order = await this.exchange.createOrder(
        signal.symbol,
        signal.orderType,
        side,
        amount,
        signal.price
      );
      await this.recordFilledOrder(order, { signal, candle, reason: signal.reason ?? "strategy" });
    } catch {
      this.logger.warn(`Failed to create order for ${signal.symbol}`);
    }
  }

  private async recordFilledOrder(
    order: Order,
    options: { signal?: Signal; candle?: Candle; reason: string }
  ): Promise<void> {
    if (order.status !== "closed" || order.filled <= 0) {
      return;
    }

    const trade = this.positionManager.processFilledOrder(order);
    const fill: BotOrderFill = {
      order,
      trade,
      reason: options.reason,
    };
    if (options.signal) fill.signal = options.signal;
    if (options.candle) fill.candle = options.candle;
    await this.config.onOrderFilled?.(fill);
  }
}

const defaultLogger: Logger = {
  info: (msg) => console.log(`[BOT] ${msg}`),
  warn: (msg) => console.warn(`[BOT] ${msg}`),
  error: (msg) => console.error(`[BOT] ${msg}`),
  debug: () => {},
};
