import type { Candle, Order, OrderType, OrderSide, Balance } from "@tb/types";

import { roundTo } from "../utils/decimal.js";

import type {
  IExchange,
  Ticker,
  OrderBook,
  FeeConfig,
  SlippageConfig,
  TradeRecord,
} from "./types.js";

interface PendingOrder extends Order {
  stopPrice?: number;
}

/**
 * Simulated exchange for backtesting.
 * Processes orders against historical candles with realistic fill logic.
 */
export class BacktestExchange implements IExchange {
  private balance: Balance;
  private orders: Map<string, PendingOrder> = new Map();
  private closedOrders: PendingOrder[] = [];
  private currentCandle: Candle | null = null;
  private candleHistory: Candle[] = [];
  private orderCounter = 0;
  private currentTime = 0;
  private fees: FeeConfig;
  private slippage: SlippageConfig;
  private trades: TradeRecord[] = [];
  private readonly exchangeId: string;

  constructor(
    initialBalance: number,
    fees: FeeConfig = { maker: 0.001, taker: 0.001 },
    slippage: SlippageConfig = { enabled: true, percentage: 0.0005 },
    exchangeId: string = "backtest"
  ) {
    this.balance = {
      total: { USDT: initialBalance },
      free: { USDT: initialBalance },
      used: { USDT: 0 },
    };
    this.fees = fees;
    this.slippage = slippage;
    this.exchangeId = exchangeId;
  }

  getExchangeId(): string {
    return this.exchangeId;
  }

  getTrades(): TradeRecord[] {
    return [...this.trades];
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getEquity(symbol: string): number {
    const [base, quote] = this.parseSymbol(symbol);
    const quoteBalance = this.balance.total[quote] ?? 0;
    const baseBalance = this.balance.total[base] ?? 0;
    const price = this.currentCandle?.close ?? 0;
    return quoteBalance + baseBalance * price;
  }

  /**
   * Advance the simulated exchange to a new candle.
   * Process pending orders against this candle's OHLC.
   */
  advanceTime(candle: Candle): void {
    this.currentCandle = candle;
    this.currentTime = candle.time;
    this.candleHistory.push(candle);
    this.processPendingOrders(candle);
  }

  private processPendingOrders(candle: Candle): void {
    for (const [id, order] of this.orders) {
      let filled = false;
      let fillPrice = 0;
      let feeRate = this.fees.taker;

      if (order.type === "market") {
        fillPrice = candle.open;
        feeRate = this.fees.taker;
        filled = true;
      } else if (order.type === "limit") {
        feeRate = this.fees.maker;
        if (order.side === "buy" && candle.low <= (order.price ?? 0)) {
          fillPrice = order.price ?? candle.open;
          filled = true;
        } else if (order.side === "sell" && candle.high >= (order.price ?? 0)) {
          fillPrice = order.price ?? candle.open;
          filled = true;
        }
      } else if (order.type === "stop" || order.type === "stop_limit") {
        const stopPrice = order.stopPrice ?? order.price ?? 0;
        if (order.side === "sell" && candle.low <= stopPrice) {
          fillPrice = stopPrice;
          feeRate = this.fees.taker;
          filled = true;
        } else if (order.side === "buy" && candle.high >= stopPrice) {
          fillPrice = stopPrice;
          feeRate = this.fees.taker;
          filled = true;
        }
      }

      if (filled) {
        fillPrice = this.applySlippage(fillPrice, order.side);
        this.fillOrder(order, fillPrice, feeRate);
        this.orders.delete(id);
      }
    }
  }

  private applySlippage(price: number, side: OrderSide): number {
    if (!this.slippage.enabled) return price;
    const slippageAmount = price * this.slippage.percentage;
    return side === "buy" ? price + slippageAmount : price - slippageAmount;
  }

  private fillOrder(order: PendingOrder, fillPrice: number, feeRate: number): void {
    const cost = order.amount * fillPrice;
    const fee = cost * feeRate;
    const [base, quote] = this.parseSymbol(order.symbol);

    if (order.side === "buy") {
      this.balance.free[quote] =
        (this.balance.free[quote] ?? 0) + (order.cost || order.amount * (order.price ?? 0));
      this.balance.used[quote] =
        (this.balance.used[quote] ?? 0) - (order.cost || order.amount * (order.price ?? 0));

      const totalCost = cost + fee;
      if ((this.balance.free[quote] ?? 0) < totalCost) {
        order.status = "canceled";
        this.closedOrders.push(order);
        return;
      }

      this.balance.free[quote] = (this.balance.free[quote] ?? 0) - totalCost;
      this.balance.total[quote] = (this.balance.free[quote] ?? 0) + (this.balance.used[quote] ?? 0);
      this.balance.free[base] = (this.balance.free[base] ?? 0) + order.amount;
      this.balance.total[base] = (this.balance.free[base] ?? 0) + (this.balance.used[base] ?? 0);
    } else {
      // Sell
      this.balance.free[base] = (this.balance.free[base] ?? 0) + order.amount;
      this.balance.used[base] = (this.balance.used[base] ?? 0) - order.amount;

      if ((this.balance.free[base] ?? 0) < order.amount) {
        order.status = "canceled";
        this.closedOrders.push(order);
        return;
      }

      this.balance.free[base] = (this.balance.free[base] ?? 0) - order.amount;
      this.balance.total[base] = (this.balance.free[base] ?? 0) + (this.balance.used[base] ?? 0);
      const proceeds = cost - fee;
      this.balance.free[quote] = (this.balance.free[quote] ?? 0) + proceeds;
      this.balance.total[quote] = (this.balance.free[quote] ?? 0) + (this.balance.used[quote] ?? 0);
    }

    order.filled = order.amount;
    order.remaining = 0;
    order.cost = cost;
    order.fee = { cost: roundTo(fee, 8), currency: quote };
    order.status = "closed";
    order.timestamp = this.currentTime;
    this.closedOrders.push(order);
  }

  private parseSymbol(symbol: string): [string, string] {
    const parts = symbol.split("/");
    return [parts[0] ?? "BTC", parts[1] ?? "USDT"];
  }

  async fetchOHLCV(
    _symbol: string,
    _timeframe: string,
    _since?: number,
    limit?: number
  ): Promise<Candle[]> {
    const count = limit ?? this.candleHistory.length;
    return this.candleHistory.slice(-count);
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    const candle = this.currentCandle;
    if (!candle) throw new Error("No candle data available");
    return {
      symbol,
      last: candle.close,
      bid: candle.close,
      ask: candle.close,
      high: candle.high,
      low: candle.low,
      volume: candle.volume,
      timestamp: candle.time,
    };
  }

  async fetchOrderBook(_symbol: string, _limit?: number): Promise<OrderBook> {
    const price = this.currentCandle?.close ?? 0;
    return {
      bids: [[price * 0.999, 1]],
      asks: [[price * 1.001, 1]],
      timestamp: this.currentTime,
    };
  }

  async fetchBalance(): Promise<Balance> {
    return {
      total: { ...this.balance.total },
      free: { ...this.balance.free },
      used: { ...this.balance.used },
    };
  }

  async fetchOpenOrders(_symbol?: string): Promise<Order[]> {
    return [...this.orders.values()].map((o) => ({ ...o }));
  }

  async fetchClosedOrders(_symbol?: string, _since?: number, limit?: number): Promise<Order[]> {
    const orders = [...this.closedOrders];
    if (limit) return orders.slice(-limit);
    return orders;
  }

  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
    stopPrice?: number
  ): Promise<Order> {
    const orderId = `bt-${++this.orderCounter}`;
    const [base, quote] = this.parseSymbol(symbol);

    // Validate balance
    if (side === "buy") {
      const orderCost = amount * (price ?? this.currentCandle?.close ?? 0);
      if ((this.balance.free[quote] ?? 0) < orderCost) {
        throw new Error(
          `Insufficient ${quote} balance: need ${orderCost}, have ${this.balance.free[quote] ?? 0}`
        );
      }
      // Reserve funds
      this.balance.free[quote] = (this.balance.free[quote] ?? 0) - orderCost;
      this.balance.used[quote] = (this.balance.used[quote] ?? 0) + orderCost;
    } else {
      if ((this.balance.free[base] ?? 0) < amount) {
        throw new Error(
          `Insufficient ${base} balance: need ${amount}, have ${this.balance.free[base] ?? 0}`
        );
      }
      // Reserve assets
      this.balance.free[base] = (this.balance.free[base] ?? 0) - amount;
      this.balance.used[base] = (this.balance.used[base] ?? 0) + amount;
    }

    const order: PendingOrder = {
      id: orderId,
      symbol,
      type,
      side,
      amount,
      price,
      stopPrice,
      filled: 0,
      remaining: amount,
      cost: 0,
      status: "open",
      timestamp: this.currentTime,
    };

    // Market orders fill immediately at next candle's open, but if we have a current candle
    // and this is during advanceTime processing, fill at open
    if (type === "market" && this.currentCandle) {
      const fillPrice = this.applySlippage(this.currentCandle.close, side);
      this.fillOrder(order, fillPrice, this.fees.taker);
      return { ...order };
    }

    this.orders.set(orderId, order);
    return { ...order };
  }

  async cancelOrder(orderId: string, _symbol?: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const [base, quote] = this.parseSymbol(order.symbol);

    // Release reserved funds
    if (order.side === "buy") {
      const reserved = order.amount * (order.price ?? 0);
      this.balance.free[quote] = (this.balance.free[quote] ?? 0) + reserved;
      this.balance.used[quote] = (this.balance.used[quote] ?? 0) - reserved;
    } else {
      this.balance.free[base] = (this.balance.free[base] ?? 0) + order.amount;
      this.balance.used[base] = (this.balance.used[base] ?? 0) - order.amount;
    }

    order.status = "canceled";
    this.closedOrders.push(order);
    this.orders.delete(orderId);
  }
}
