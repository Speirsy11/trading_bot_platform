import type { Order } from "@tb/types";
import { describe, it, expect, beforeEach } from "vitest";

import { PositionManager } from "./PositionManager";

function makeFilledOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    symbol: "BTC/USDT",
    type: "market",
    side: "buy",
    amount: 1,
    filled: 1,
    remaining: 0,
    cost: 100,
    status: "closed",
    timestamp: Date.now(),
    price: 100,
    ...overrides,
  };
}

describe("PositionManager", () => {
  let manager: PositionManager;

  beforeEach(() => {
    manager = new PositionManager();
  });

  it("opens a long position on buy", () => {
    manager.processFilledOrder(makeFilledOrder());
    expect(manager.hasPosition("BTC/USDT")).toBe(true);
    const pos = manager.getPosition("BTC/USDT")!;
    expect(pos.side).toBe("long");
    expect(pos.amount).toBe(1);
    expect(pos.entryPrice).toBe(100);
  });

  it("closes long position on sell and calculates PnL", () => {
    manager.processFilledOrder(makeFilledOrder());
    const trade = manager.processFilledOrder(
      makeFilledOrder({
        id: "order-2",
        side: "sell",
        price: 110,
        cost: 110,
      })
    );

    expect(trade).not.toBeNull();
    expect(trade!.pnl).toBe(10); // (110 - 100) * 1 = 10
    expect(manager.hasPosition("BTC/USDT")).toBe(false);
  });

  it("opens a short position on sell without existing position", () => {
    manager.processFilledOrder(makeFilledOrder({ side: "sell" }));
    expect(manager.hasPosition("BTC/USDT")).toBe(true);
    const pos = manager.getPosition("BTC/USDT")!;
    expect(pos.side).toBe("short");
  });

  it("averages up an existing long position", () => {
    manager.processFilledOrder(makeFilledOrder({ price: 100, cost: 100, filled: 1 }));
    manager.processFilledOrder(
      makeFilledOrder({
        id: "order-2",
        price: 200,
        cost: 200,
        filled: 1,
      })
    );

    const pos = manager.getPosition("BTC/USDT")!;
    expect(pos.amount).toBe(2);
    expect(pos.entryPrice).toBe(150); // (100+200)/2
  });

  it("updates unrealised PnL on price update", () => {
    manager.processFilledOrder(makeFilledOrder({ price: 100 }));
    manager.updatePrice("BTC/USDT", 120);

    const pos = manager.getPosition("BTC/USDT")!;
    expect(pos.unrealisedPnl).toBe(20); // (120 - 100) * 1
  });

  it("does nothing for non-closed or zero-filled orders", () => {
    const result = manager.processFilledOrder(makeFilledOrder({ status: "open", filled: 0 }));
    expect(result).toBeNull();
    expect(manager.getPositionCount()).toBe(0);
  });

  it("accounts for fees when closing", () => {
    manager.processFilledOrder(makeFilledOrder({ price: 100 }));
    const trade = manager.processFilledOrder(
      makeFilledOrder({
        id: "order-2",
        side: "sell",
        price: 110,
        cost: 110,
        fee: { cost: 0.5, currency: "USDT" },
      })
    );

    expect(trade).not.toBeNull();
    expect(trade!.pnl).toBe(9.5); // 10 - 0.5 fee
  });

  it("tracks closed trades", () => {
    manager.processFilledOrder(makeFilledOrder());
    manager.processFilledOrder(
      makeFilledOrder({ id: "order-2", side: "sell", price: 110, cost: 110 })
    );

    expect(manager.getClosedTrades()).toHaveLength(1);
  });

  it("resets properly", () => {
    manager.processFilledOrder(makeFilledOrder());
    manager.reset();
    expect(manager.getPositionCount()).toBe(0);
    expect(manager.getClosedTrades()).toHaveLength(0);
  });
});
