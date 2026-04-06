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
    const key = `${sub.exchange}:${sub.symbol}:${sub.timeframe}`;
    if (this.activeLoops.has(key)) return;

    const controller = new AbortController();
    this.activeLoops.set(key, controller);
    this.running = true;

    this.watchLoop(sub, controller.signal).catch((err) => {
      logger.error({ ...sub, error: String(err) }, "Watch loop crashed");
    });
  }

  private async watchLoop(sub: Subscription, signal: AbortSignal): Promise<void> {
    const exchange = this.getExchange(sub.exchange);
    const reconnector = new ReconnectHandler();
    const key = `${sub.exchange}:${sub.symbol}:${sub.timeframe}`;
    this.reconnectHandlers.set(key, reconnector);

    while (!signal.aborted) {
      try {
        const ohlcv = await exchange.watchOHLCV(sub.symbol, sub.timeframe);
        for (const raw of ohlcv) {
          const candle = this.processor.processRawKline(raw);
          if (candle) {
            this.emit("candle", { ...sub, candle });
          }
        }
        reconnector.reset();
      } catch (err) {
        if (signal.aborted) break;
        logger.error({ ...sub, error: String(err) }, "WebSocket error");
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    reconnector.destroy();
    this.reconnectHandlers.delete(key);
  }

  unsubscribe(sub: Subscription): void {
    const key = `${sub.exchange}:${sub.symbol}:${sub.timeframe}`;
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
}
