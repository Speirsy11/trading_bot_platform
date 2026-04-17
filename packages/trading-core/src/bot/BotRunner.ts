import type { Candle } from "@tb/types";

import type { IExchange } from "../exchange/types";
import { timeframeToMs } from "../utils/timeframe";

import type { Bot } from "./Bot";

export type AfterCandleCallback = () => Promise<void>;

/**
 * Execution loop for live/paper bots.
 * Polls the exchange for new candles and feeds them to the bot.
 */
export class BotRunner {
  private bot: Bot;
  private exchange: IExchange;
  private symbol: string;
  private timeframe: string;
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastCandleTime = 0;
  private afterCandle: AfterCandleCallback | undefined;

  constructor(
    bot: Bot,
    exchange: IExchange,
    symbol: string,
    timeframe: string,
    afterCandle?: AfterCandleCallback
  ) {
    this.bot = bot;
    this.exchange = exchange;
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.afterCandle = afterCandle;
  }

  async start(): Promise<void> {
    this.running = true;
    const intervalMs = timeframeToMs(this.timeframe);

    // Initial fetch to set lastCandleTime
    const initialCandles = await this.exchange.fetchOHLCV(
      this.symbol,
      this.timeframe,
      undefined,
      2
    );
    if (initialCandles.length > 1) {
      // Use second-to-last candle to avoid treating an in-progress candle as completed
      this.lastCandleTime = initialCandles[initialCandles.length - 2]!.time;
    } else if (initialCandles.length > 0) {
      this.lastCandleTime = initialCandles[initialCandles.length - 1]!.time;
    }

    this.intervalId = setInterval(
      () => {
        void this.poll();
      },
      Math.min(intervalMs, 60_000)
    );
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const candles = await this.exchange.fetchOHLCV(
        this.symbol,
        this.timeframe,
        this.lastCandleTime + 1,
        10
      );

      // Process only completed candles (skip the latest incomplete one)
      const candleMs = timeframeToMs(this.timeframe);
      const completedCandles = candles.filter(
        (c) => c.time > this.lastCandleTime && c.time + candleMs <= Date.now()
      );

      for (const candle of completedCandles) {
        await this.bot.processCandle(candle);
        this.lastCandleTime = candle.time;
        if (this.afterCandle) {
          await this.afterCandle();
        }
      }
    } catch {
      // Will retry on next interval
    }
  }

  /**
   * Feed a single candle externally (for testing or WebSocket-based feeds).
   */
  async feedCandle(candle: Candle): Promise<void> {
    if (!this.running) return;
    if (candle.time <= this.lastCandleTime) return;
    await this.bot.processCandle(candle);
    this.lastCandleTime = candle.time;
  }
}
