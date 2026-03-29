import type { Candle, Order, OrderType, OrderSide, Balance } from "@tb/types";
import type { Exchange as CcxtExchange, Order as CcxtOrder } from "ccxt";

import type { IExchange, Ticker, OrderBook } from "./types.js";

/**
 * Live exchange wrapper. Delegates all calls to a CCXT instance.
 */
export class LiveExchange implements IExchange {
  private exchange: CcxtExchange;

  constructor(exchange: CcxtExchange) {
    this.exchange = exchange;
  }

  getExchangeId(): string {
    return this.exchange.id;
  }

  async fetchOHLCV(
    symbol: string,
    timeframe: string,
    since?: number,
    limit?: number
  ): Promise<Candle[]> {
    const raw = await this.exchange.fetchOHLCV(symbol, timeframe, since, limit);
    return raw.map((c: (number | undefined)[]) => ({
      time: c[0] as number,
      open: c[1] as number,
      high: c[2] as number,
      low: c[3] as number,
      close: c[4] as number,
      volume: c[5] as number,
    }));
  }

  async fetchTicker(symbol: string): Promise<Ticker> {
    const t = await this.exchange.fetchTicker(symbol);
    return {
      symbol: t.symbol,
      last: t.last ?? 0,
      bid: t.bid ?? 0,
      ask: t.ask ?? 0,
      high: t.high ?? 0,
      low: t.low ?? 0,
      volume: t.baseVolume ?? 0,
      timestamp: t.timestamp ?? Date.now(),
    };
  }

  async fetchOrderBook(symbol: string, limit?: number): Promise<OrderBook> {
    const ob = await this.exchange.fetchOrderBook(symbol, limit);
    return {
      bids: ob.bids.map((b) => [Number(b[0] ?? 0), Number(b[1] ?? 0)] as [number, number]),
      asks: ob.asks.map((a) => [Number(a[0] ?? 0), Number(a[1] ?? 0)] as [number, number]),
      timestamp: ob.timestamp ?? Date.now(),
    };
  }

  async fetchBalance(): Promise<Balance> {
    const b = await this.exchange.fetchBalance();
    return {
      total: (b.total ?? {}) as unknown as Record<string, number>,
      free: (b.free ?? {}) as unknown as Record<string, number>,
      used: (b.used ?? {}) as unknown as Record<string, number>,
    };
  }

  async fetchOpenOrders(symbol?: string): Promise<Order[]> {
    const orders = await this.exchange.fetchOpenOrders(symbol);
    return orders.map((o: CcxtOrder) => this.mapOrder(o));
  }

  async fetchClosedOrders(symbol?: string, since?: number, limit?: number): Promise<Order[]> {
    const orders = await this.exchange.fetchClosedOrders(symbol, since, limit);
    return orders.map((o: CcxtOrder) => this.mapOrder(o));
  }

  async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
    stopPrice?: number
  ): Promise<Order> {
    const params = stopPrice ? { stopPrice } : undefined;
    const raw = await this.exchange.createOrder(symbol, type, side, amount, price, params);
    return this.mapOrder(raw);
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<void> {
    await this.exchange.cancelOrder(orderId, symbol);
  }

  private mapOrder(o: CcxtOrder): Order {
    return {
      id: o.id,
      symbol: o.symbol,
      type: (o.type ?? "market") as OrderType,
      side: o.side as OrderSide,
      amount: o.amount ?? 0,
      price: o.price ?? undefined,
      filled: o.filled ?? 0,
      remaining: o.remaining ?? 0,
      cost: o.cost ?? 0,
      status: this.mapStatus(o.status ?? "open"),
      timestamp: o.timestamp ?? Date.now(),
      fee: o.fee ? { cost: o.fee.cost ?? 0, currency: o.fee.currency ?? "" } : undefined,
    };
  }

  private mapStatus(status: string): Order["status"] {
    switch (status) {
      case "open":
        return "open";
      case "closed":
        return "closed";
      case "canceled":
        return "canceled";
      case "rejected":
        return "canceled";
      case "expired":
        return "expired";
      default:
        return "open";
    }
  }
}
