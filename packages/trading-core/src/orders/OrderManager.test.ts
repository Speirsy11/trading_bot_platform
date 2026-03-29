import type { Order } from "@tb/types";
import { describe, it, expect, beforeEach } from "vitest";

import { OrderManager } from "./OrderManager.js";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    symbol: "BTC/USDT",
    type: "market",
    side: "buy",
    amount: 1,
    filled: 0,
    remaining: 1,
    cost: 0,
    status: "open",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("OrderManager", () => {
  let manager: OrderManager;

  beforeEach(() => {
    manager = new OrderManager();
  });

  it("adds and tracks open orders", () => {
    manager.addOrder(makeOrder());
    expect(manager.getOpenOrderCount()).toBe(1);
    expect(manager.getOpenOrders()).toHaveLength(1);
  });

  it("moves order to closed on update", () => {
    manager.addOrder(makeOrder());
    manager.updateOrder(makeOrder({ status: "closed", filled: 1, remaining: 0 }));
    expect(manager.getOpenOrderCount()).toBe(0);
    expect(manager.getClosedOrders()).toHaveLength(1);
  });

  it("cancels an open order", () => {
    manager.addOrder(makeOrder());
    const cancelled = manager.cancelOrder("order-1");
    expect(cancelled).toBe(true);
    expect(manager.getOpenOrderCount()).toBe(0);
    expect(manager.getClosedOrders()[0]!.status).toBe("canceled");
  });

  it("returns false when cancelling non-existent order", () => {
    expect(manager.cancelOrder("non-existent")).toBe(false);
  });

  it("retrieves order by id from open", () => {
    manager.addOrder(makeOrder());
    expect(manager.getOrder("order-1")).toBeDefined();
  });

  it("retrieves order by id from closed", () => {
    manager.addOrder(makeOrder({ status: "closed" }));
    expect(manager.getOrder("order-1")).toBeDefined();
  });

  it("resets all orders", () => {
    manager.addOrder(makeOrder());
    manager.addOrder(makeOrder({ id: "order-2", status: "closed" }));
    manager.reset();
    expect(manager.getOpenOrderCount()).toBe(0);
    expect(manager.getClosedOrders()).toHaveLength(0);
  });
});
