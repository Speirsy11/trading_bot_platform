import type { Candle, Order, OrderType, OrderSide, Balance } from "@tb/types";

import { roundTo } from "../utils/decimal";

import type { IExchange, Ticker, OrderBook, FeeConfig, SlippageConfig } from "./types";

/**
 * Paper trading exchange. Uses real market data (from another exchange source)
 * but simulated order execution, similar to BacktestExchange.
 */
export class PaperExchange implements IExchange {
  private realExchange: IExchange;
  private balance: Balance;
  private orders: Map<string, Order> = new Map();
  private closedOrders: Order[] = [];
  private orderCounter = 0;
  private fees: FeeConfig;
  private slippage: SlippageConfig;

  constructor(
    realExchange: IExchange,
    initialBalance: number,
    fees: FeeConfig = { maker: 0.001, taker: 0.001 },
    slippage: SlippageConfig = { enabled: true, percentage: 0.0005 }
  ) {
    this.realExchange = realExchange;
    this.balance = {
      total: { USDT: initialBalance },
      free: { USDT: initialBalance },
      used: { USDT: 0 },
    };
    this.fees = fees;
    this.slippage = slippage;
  }

  getExchangeId(): string {
    return `paper-${this.realExchange.getExchangeId()}`;
  }

  async fetchOHLCV(
    symbol: string,
    timeframe: string,
    since?: number,
    limit?: number
  ): Promise<Candle[]> {
    return this.realExchange.fetchOHLCV(symbol, timeframe, since, limit);
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    return this.realExchange.fetchTicker(symbol);
  }

  async fetchOrderBook(symbol: string, limit?: number): Promise<OrderBook> {
    return this.realExchange.fetchOrderBook(symbol, limit);
  }

  async fetchBalance(): Promise<Balance> {
    return {
      total: { ...this.balance.total },
      free: { ...this.balance.free },
      used: { ...this.balance.used },
    };
  }

  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    const orders = [...this.orders.values()];
    if (symbol) return orders.filter((o) => o.symbol === symbol);
    return orders;
  }

  async fetchClosedOrders(_symbol?: string, _since?: number, limit?: number): Promise<Order[]> {
    if (limit) return this.closedOrders.slice(-limit);
    return [...this.closedOrders];
  }

  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
    _stopPrice?: number
  ): Promise<Order> {
    if (amount <= 0) throw new Error("Order amount must be positive");
    const orderId = `paper-${++this.orderCounter}`;
    const [base, quote] = this.parseSymbol(symbol);

    if (type === "market") {
      // Fill immediately using real ticker price
      const ticker = await this.realExchange.fetchTicker(symbol);
      let fillPrice = ticker.last;
      if (this.slippage.enabled) {
        const slip = fillPrice * this.slippage.percentage;
        fillPrice = side === "buy" ? fillPrice + slip : fillPrice - slip;
      }
      const cost = amount * fillPrice;
      const fee = cost * this.fees.taker;

      if (side === "buy") {
        if ((this.balance.free[quote] ?? 0) < cost + fee)
          throw new Error(`Insufficient ${quote} balance`);
        this.balance.free[quote] = (this.balance.free[quote] ?? 0) - (cost + fee);
        this.balance.total[quote] =
          (this.balance.free[quote] ?? 0) + (this.balance.used[quote] ?? 0);
        this.balance.free[base] = (this.balance.free[base] ?? 0) + amount;
        this.balance.total[base] = (this.balance.free[base] ?? 0) + (this.balance.used[base] ?? 0);
      } else {
        if ((this.balance.free[base] ?? 0) < amount)
          throw new Error(`Insufficient ${base} balance`);
        this.balance.free[base] = (this.balance.free[base] ?? 0) - amount;
        this.balance.total[base] = (this.balance.free[base] ?? 0) + (this.balance.used[base] ?? 0);
        this.balance.free[quote] = (this.balance.free[quote] ?? 0) + (cost - fee);
        this.balance.total[quote] =
          (this.balance.free[quote] ?? 0) + (this.balance.used[quote] ?? 0);
      }

      const order: Order = {
        id: orderId,
        symbol,
        type,
        side,
        amount,
        price: fillPrice,
        filled: amount,
        remaining: 0,
        cost,
        status: "closed",
        timestamp: Date.now(),
        fee: { cost: roundTo(fee, 8), currency: quote },
      };
      this.closedOrders.push(order);
      return order;
    }

    // Limit/stop orders — store as pending
    if ((type === "limit" || type === "stop_limit") && (price == null || price <= 0)) {
      throw new Error("Limit/stop-limit orders require a positive price");
    }

    const order: Order = {
      id: orderId,
      symbol,
      type,
      side,
      amount,
      price,
      filled: 0,
      remaining: amount,
      cost: 0,
      status: "open",
      timestamp: Date.now(),
    };
    this.orders.set(orderId, order);
    return order;
  }

  async cancelOrder(orderId: string, _symbol?: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    order.status = "canceled";
    this.closedOrders.push(order);
    this.orders.delete(orderId);
  }

  private parseSymbol(symbol: string): [string, string] {
    const parts = symbol.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid symbol format: ${symbol}. Expected "BASE/QUOTE"`);
    }
    return [parts[0], parts[1]];
  }
}
