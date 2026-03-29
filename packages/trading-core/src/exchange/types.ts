import type { Candle, Order, OrderType, OrderSide, Balance } from "@tb/types";

export interface Ticker {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

export interface OrderBook {
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
}

export interface Position {
  symbol: string;
  side: "long" | "short";
  amount: number;
  entryPrice: number;
  currentPrice: number;
  unrealisedPnl: number;
  realisedPnl: number;
  timestamp: number;
}

export interface TradeRecord {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  amount: number;
  price: number;
  cost: number;
  fee: number;
  pnl: number;
  entryPrice: number;
  exitPrice: number;
  timestamp: number;
  reason?: string;
}

export interface SlippageConfig {
  enabled: boolean;
  percentage: number;
}

export interface FeeConfig {
  maker: number;
  taker: number;
}

export interface IExchange {
  fetchOHLCV(symbol: string, timeframe: string, since?: number, limit?: number): Promise<Candle[]>;
  fetchTicker(symbol: string): Promise<Ticker>;
  fetchOrderBook(symbol: string, limit?: number): Promise<OrderBook>;
  fetchBalance(): Promise<Balance>;
  fetchOpenOrders(symbol?: string): Promise<Order[]>;
  fetchClosedOrders(symbol?: string, since?: number, limit?: number): Promise<Order[]>;
  createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
    stopPrice?: number
  ): Promise<Order>;
  cancelOrder(orderId: string, symbol?: string): Promise<void>;
  getExchangeId(): string;
}

export type { Candle, Order, OrderType, OrderSide, Balance };
