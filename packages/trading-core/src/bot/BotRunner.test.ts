import type { Candle } from "@tb/types";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { IExchange } from "../exchange/types";

import type { Bot } from "./Bot";
import { BotRunner } from "./BotRunner";

function makeCandle(time: number): Candle {
  return { time, open: 100, high: 110, low: 90, close: 105, volume: 1000 };
}

/**
 * Minimal mock IExchange that throws on fetchOHLCV by default.
 * Tests can override fetchOHLCVImpl to return candles instead.
 */
function makeMockExchange(opts: { fetchOHLCVImpl?: () => Promise<Candle[]> }): IExchange {
  return {
    fetchOHLCV: opts.fetchOHLCVImpl ?? (() => Promise.reject(new Error("exchange error"))),
    fetchTicker: async () => ({
      symbol: "BTC/USDT",
      last: 100,
      bid: 99,
      ask: 101,
      high: 110,
      low: 90,
      volume: 1000,
      timestamp: Date.now(),
    }),
    fetchOrderBook: async () => ({ bids: [], asks: [], timestamp: Date.now() }),
    fetchBalance: async () => ({ free: { USDT: 10000 }, used: {}, total: { USDT: 10000 } }),
    fetchOpenOrders: async () => [],
    fetchClosedOrders: async () => [],
    createOrder: async () => {
      throw new Error("not implemented");
    },
    cancelOrder: async () => {},
    getExchangeId: () => "mock",
  };
}

/**
 * Minimal mock Bot that does nothing on processCandle.
 */
function makeMockBot(): Bot {
  return {
    id: "test-bot",
    name: "Test Bot",
    config: {
      id: "test-bot",
      name: "Test Bot",
      symbol: "BTC/USDT",
      timeframe: "1m",
      strategyParams: {},
    },
    processCandle: vi.fn().mockResolvedValue([]),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue("RUNNING"),
  } as unknown as Bot;
}

describe("BotRunner error handling", () => {
  let bot: Bot;
  let onError: ReturnType<typeof vi.fn>;
  let onTooManyErrors: ReturnType<typeof vi.fn>;
  let stopSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    bot = makeMockBot();
    onError = vi.fn();
    onTooManyErrors = vi.fn();
  });

  /** Force the runner into the running state so poll() doesn't early-return. */
  function startRunner(runner: BotRunner) {
    (runner as unknown as { running: boolean }).running = true;
  }

  it("calls onError when fetchOHLCV throws", async () => {
    const exchange = makeMockExchange({});
    const runner = new BotRunner(bot, exchange, "BTC/USDT", "1m", { onError, onTooManyErrors });
    stopSpy = vi.spyOn(runner, "stop").mockResolvedValue(undefined);
    startRunner(runner);

    await (runner as unknown as { poll(): Promise<void> }).poll();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
  });

  it("calls onTooManyErrors and stops after 5 consecutive failures", async () => {
    const exchange = makeMockExchange({});
    const runner = new BotRunner(bot, exchange, "BTC/USDT", "1m", { onError, onTooManyErrors });
    stopSpy = vi.spyOn(runner, "stop").mockResolvedValue(undefined);
    startRunner(runner);

    const poll = (runner as unknown as { poll(): Promise<void> }).poll.bind(runner);

    for (let i = 0; i < 5; i++) {
      await poll();
    }

    expect(onError).toHaveBeenCalledTimes(5);
    expect(stopSpy).toHaveBeenCalledOnce();
    expect(onTooManyErrors).toHaveBeenCalledOnce();
  });

  it("resets consecutiveErrors on a successful poll", async () => {
    // Sequence: fail, fail, fail, succeed, fail, fail, fail, fail, fail (5th consecutive = circuit trips)
    const responses: Array<() => Promise<Candle[]>> = [
      () => Promise.reject(new Error("err1")),
      () => Promise.reject(new Error("err2")),
      () => Promise.reject(new Error("err3")),
      () => Promise.resolve([makeCandle(1000), makeCandle(2000)]), // success — resets counter
      () => Promise.reject(new Error("err4")),
      () => Promise.reject(new Error("err5")),
      () => Promise.reject(new Error("err6")),
      () => Promise.reject(new Error("err7")),
      () => Promise.reject(new Error("err8")), // 5th consecutive failure — circuit trips
    ];
    let callIndex = 0;
    const exchange = makeMockExchange({
      fetchOHLCVImpl: async () => responses[callIndex++]!(),
    });

    const runner = new BotRunner(bot, exchange, "BTC/USDT", "1m", { onError, onTooManyErrors });
    stopSpy = vi.spyOn(runner, "stop").mockResolvedValue(undefined);
    startRunner(runner);

    const poll = (runner as unknown as { poll(): Promise<void> }).poll.bind(runner);

    // 3 failures
    await poll();
    await poll();
    await poll();
    expect(onError).toHaveBeenCalledTimes(3);

    // 1 success — should reset counter
    await poll();
    expect(stopSpy).not.toHaveBeenCalled();
    expect(onTooManyErrors).not.toHaveBeenCalled();

    // 4 more failures — circuit breaker not yet fired
    for (let i = 0; i < 4; i++) {
      await poll();
    }
    expect(onTooManyErrors).not.toHaveBeenCalled();

    // 5th consecutive failure — now it fires
    await poll();
    expect(stopSpy).toHaveBeenCalledOnce();
    expect(onTooManyErrors).toHaveBeenCalledOnce();
  });
});
