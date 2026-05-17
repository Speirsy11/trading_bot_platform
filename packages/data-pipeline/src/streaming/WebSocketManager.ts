import { EventEmitter } from "events";

import { createLogger } from "@tb/config";
import ccxt from "ccxt";

import { ReconnectHandler } from "./ReconnectHandler";
import { StreamProcessor } from "./StreamProcessor";

const logger = createLogger("websocket-manager");

interface Subscription {
  exchange: string;
  symbol: string;
  timeframe: string;
}

interface TradeEvent {
  id?: string;
  side?: string;
  price: number;
  amount: number;
  cost?: number;
  timestamp: number;
  raw?: unknown;
}

interface TickerEvent {
  bid?: number;
  ask?: number;
  last: number;
  volume?: number;
  change24h?: number;
  timestamp: number;
  raw?: unknown;
}

interface OrderBookEvent {
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
  raw?: unknown;
}

export class WebSocketManager extends EventEmitter {
  private exchanges: Map<string, InstanceType<(typeof ccxt.pro)[keyof typeof ccxt.pro]>>;
  private reconnectHandlers: Map<string, ReconnectHandler>;
  private processor: StreamProcessor;
  private running: boolean = false;
  private activeLoops: Map<string, AbortController>;

  constructor() {
    super();
    this.exchanges = new Map();
    this.reconnectHandlers = new Map();
    this.processor = new StreamProcessor();
    this.activeLoops = new Map();
  }

  private getExchange(exchangeId: string) {
    let exchange = this.exchanges.get(exchangeId);
    if (!exchange) {
      const ExchangeClass = (
        ccxt.pro as unknown as Record<
          string,
          new (
            config?: Record<string, unknown>
          ) => InstanceType<(typeof ccxt.pro)[keyof typeof ccxt.pro]>
        >
      )[exchangeId];
      if (!ExchangeClass) {
        throw new Error(`Unsupported pro exchange: ${exchangeId}`);
      }
      exchange = new ExchangeClass({ enableRateLimit: true });
      this.exchanges.set(exchangeId, exchange);
    }
    return exchange;
  }

  async subscribe(sub: Subscription): Promise<void> {
    const key = `${sub.exchange}:${sub.symbol}:${sub.timeframe}:ohlcv`;
    if (!this.activeLoops.has(key)) {
      const controller = new AbortController();
      this.activeLoops.set(key, controller);
      this.running = true;

      this.watchLoop(sub, controller.signal).catch((err) => {
        logger.error({ ...sub, error: String(err) }, "Watch loop crashed");
      });
    }

    const tradeKey = `${sub.exchange}:${sub.symbol}:trades`;
    if (!this.activeLoops.has(tradeKey)) {
      const tradeController = new AbortController();
      this.activeLoops.set(tradeKey, tradeController);
      this.watchTradesLoop(sub, tradeController.signal).catch((err) => {
        logger.error({ ...sub, error: String(err) }, "Trade watch loop crashed");
      });
    }

    const tickerKey = `${sub.exchange}:${sub.symbol}:ticker`;
    if (!this.activeLoops.has(tickerKey)) {
      const tickerController = new AbortController();
      this.activeLoops.set(tickerKey, tickerController);
      this.watchTickerLoop(sub, tickerController.signal).catch((err) => {
        logger.error({ ...sub, error: String(err) }, "Ticker watch loop crashed");
      });
    }

    const orderBookKey = `${sub.exchange}:${sub.symbol}:orderbook`;
    if (!this.activeLoops.has(orderBookKey)) {
      const orderBookController = new AbortController();
      this.activeLoops.set(orderBookKey, orderBookController);
      this.watchOrderBookLoop(sub, orderBookController.signal).catch((err) => {
        logger.error({ ...sub, error: String(err) }, "Order book watch loop crashed");
      });
    }
  }

  private async watchLoop(sub: Subscription, signal: AbortSignal): Promise<void> {
    const exchange = this.getExchange(sub.exchange);
    const reconnector = new ReconnectHandler();
    const key = `${sub.exchange}:${sub.symbol}:${sub.timeframe}`;
    this.reconnectHandlers.set(key, reconnector);

    while (!signal.aborted) {
      try {
        const ohlcv = await exchange.watchOHLCV(sub.symbol, sub.timeframe);
        this.emit("connection", { ...sub, status: "connected", stream: "ohlcv" });
        for (const raw of ohlcv) {
          const candle = this.processor.processRawKline(raw);
          if (candle) {
            this.emit("candle", { ...sub, candle });
          }
        }
        reconnector.reset();
      } catch (err) {
        if (signal.aborted) break;
        this.emit("connection", { ...sub, status: "disconnected", stream: "ohlcv" });
        logger.error({ ...sub, error: String(err) }, "WebSocket error");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    reconnector.destroy();
    this.reconnectHandlers.delete(key);
  }

  private async watchTradesLoop(sub: Subscription, signal: AbortSignal): Promise<void> {
    const exchange = this.getExchange(sub.exchange);

    while (!signal.aborted) {
      try {
        const trades = await exchange.watchTrades(sub.symbol);
        this.emit("connection", { ...sub, status: "connected", stream: "trades" });
        for (const rawTrade of trades as unknown as Array<Record<string, unknown>>) {
          const trade = this.normalizeTrade(rawTrade);
          if (trade) this.emit("trade", { exchange: sub.exchange, symbol: sub.symbol, trade });
        }
      } catch (err) {
        if (signal.aborted) break;
        this.emit("connection", { ...sub, status: "disconnected", stream: "trades" });
        logger.error({ ...sub, error: String(err) }, "Trade WebSocket error");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  private async watchTickerLoop(sub: Subscription, signal: AbortSignal): Promise<void> {
    const exchange = this.getExchange(sub.exchange);

    while (!signal.aborted) {
      try {
        const rawTicker = (await exchange.watchTicker(sub.symbol)) as unknown as Record<
          string,
          unknown
        >;
        this.emit("connection", { ...sub, status: "connected", stream: "ticker" });
        const ticker = this.normalizeTicker(rawTicker);
        if (ticker) this.emit("ticker", { exchange: sub.exchange, symbol: sub.symbol, ticker });
      } catch (err) {
        if (signal.aborted) break;
        this.emit("connection", { ...sub, status: "disconnected", stream: "ticker" });
        logger.error({ ...sub, error: String(err) }, "Ticker WebSocket error");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async watchOrderBookLoop(sub: Subscription, signal: AbortSignal): Promise<void> {
    const exchange = this.getExchange(sub.exchange);

    while (!signal.aborted) {
      try {
        const rawOrderBook = (await exchange.watchOrderBook(sub.symbol)) as unknown as Record<
          string,
          unknown
        >;
        this.emit("connection", { ...sub, status: "connected", stream: "orderbook" });
        const orderBook = this.normalizeOrderBook(rawOrderBook);
        if (orderBook)
          this.emit("orderBook", { exchange: sub.exchange, symbol: sub.symbol, orderBook });
      } catch (err) {
        if (signal.aborted) break;
        this.emit("connection", { ...sub, status: "disconnected", stream: "orderbook" });
        logger.error({ ...sub, error: String(err) }, "Order book WebSocket error");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  unsubscribe(sub: Subscription): void {
    const key = `${sub.exchange}:${sub.symbol}:${sub.timeframe}:ohlcv`;
    const controller = this.activeLoops.get(key);
    if (controller) {
      controller.abort();
      this.activeLoops.delete(key);
    }
  }

  async close(): Promise<void> {
    this.running = false;
    for (const [, controller] of this.activeLoops) {
      controller.abort();
    }
    this.activeLoops.clear();

    for (const exchange of this.exchanges.values()) {
      if (typeof exchange.close === "function") {
        await exchange.close();
      }
    }
    this.exchanges.clear();
    this.reconnectHandlers.clear();
  }

  private normalizeTrade(raw: Record<string, unknown>): TradeEvent | null {
    const price = Number(raw["price"]);
    const amount = Number(raw["amount"]);
    const timestamp = Number(raw["timestamp"] ?? Date.now());
    if (!Number.isFinite(price) || !Number.isFinite(amount)) return null;
    return {
      id: typeof raw["id"] === "string" ? raw["id"] : undefined,
      side: typeof raw["side"] === "string" ? raw["side"] : undefined,
      price,
      amount,
      cost: raw["cost"] == null ? undefined : Number(raw["cost"]),
      timestamp,
      raw,
    };
  }

  private normalizeTicker(raw: Record<string, unknown>): TickerEvent | null {
    const last = Number(raw["last"] ?? raw["close"]);
    const timestamp = Number(raw["timestamp"] ?? Date.now());
    if (!Number.isFinite(last)) return null;
    return {
      bid: raw["bid"] == null ? undefined : Number(raw["bid"]),
      ask: raw["ask"] == null ? undefined : Number(raw["ask"]),
      last,
      volume: raw["baseVolume"] == null ? undefined : Number(raw["baseVolume"]),
      change24h: raw["percentage"] == null ? undefined : Number(raw["percentage"]),
      timestamp,
      raw,
    };
  }

  private normalizeOrderBook(raw: Record<string, unknown>): OrderBookEvent | null {
    const bids = normalizeLevels(raw["bids"]);
    const asks = normalizeLevels(raw["asks"]);
    if (bids.length === 0 && asks.length === 0) return null;
    return {
      bids,
      asks,
      timestamp: Number(raw["timestamp"] ?? Date.now()),
      raw,
    };
  }
}

function normalizeLevels(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((level) => {
      if (!Array.isArray(level)) return null;
      const price = Number(level[0]);
      const amount = Number(level[1]);
      if (!Number.isFinite(price) || !Number.isFinite(amount)) return null;
      return [price, amount] as [number, number];
    })
    .filter((level): level is [number, number] => level !== null);
}
