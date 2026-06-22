import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTrpcContext } from "../context";
import { createCaller } from "../router";

/** Insert chain that is both awaitable and exposes `.returning()`. */
function insertChain<T>(rows: T) {
  return {
    returning: vi.fn().mockResolvedValue(rows),
    then: (resolve: (value: T) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
}

function createTradingDb() {
  const settleWhere = vi.fn().mockResolvedValue(undefined);
  return {
    insert: vi.fn(() => ({ values: vi.fn(() => insertChain([{ id: "audit-1" }])) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: settleWhere })) })),
  };
}

function caller(db: unknown) {
  return createCaller(
    createTrpcContext(
      {
        db: db as never,
        redis: {} as never,
        queues: {} as never,
        exchangeManager: {} as never,
        marketData: {} as never,
        keyVault: {} as never,
        exportsDir: "/tmp/exports",
      },
      { headers: { authorization: "Bearer test-token" } } as never
    )
  );
}

beforeEach(() => {
  vi.stubEnv("API_AUTH_TOKEN", "test-token");
  vi.stubEnv("APP_MODE", "testing");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("trading.placeOrder", () => {
  it("simulates a market order and settles its audit row in testing mode", async () => {
    const db = createTradingDb();
    const result = await caller(db).trading.placeOrder({
      exchange: "binance",
      symbol: "BTC/USDT",
      side: "buy",
      type: "market",
      amount: 0.5,
    });

    expect(result).toMatchObject({ simulated: true, status: "closed", filled: 0.5, remaining: 0 });
    expect(db.insert).toHaveBeenCalledTimes(1); // audit row recorded
    expect(db.update).toHaveBeenCalledTimes(1); // audit row settled with the simulated order id
  });

  it("rejects limit orders without a price", async () => {
    await expect(
      caller(createTradingDb()).trading.placeOrder({
        exchange: "binance",
        symbol: "BTC/USDT",
        side: "buy",
        type: "limit",
        amount: 1,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects limit orders that exceed the notional cap", async () => {
    vi.stubEnv("MAX_NOTIONAL_USD", "1000");
    await expect(
      caller(createTradingDb()).trading.placeOrder({
        exchange: "binance",
        symbol: "BTC/USDT",
        side: "buy",
        type: "limit",
        amount: 1,
        price: 5000,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires a valid auth token", async () => {
    vi.stubEnv("API_AUTH_TOKEN", "a-different-token");
    await expect(
      caller(createTradingDb()).trading.placeOrder({
        exchange: "binance",
        symbol: "BTC/USDT",
        side: "buy",
        type: "market",
        amount: 1,
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("trading.cancelOrder", () => {
  it("simulates a cancel and records an audit row in testing mode", async () => {
    const db = createTradingDb();
    const result = await caller(db).trading.cancelOrder({
      exchange: "binance",
      symbol: "BTC/USDT",
      orderId: "order-1",
    });

    expect(result).toMatchObject({ success: true, simulated: true, orderId: "order-1" });
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});
