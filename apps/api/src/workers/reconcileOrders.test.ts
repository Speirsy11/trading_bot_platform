import { beforeEach, describe, expect, it, vi } from "vitest";

import { reconcileOpenOrders } from "./reconcileOrders";

// ---------------------------------------------------------------------------
// Minimal db mock helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    exchangeId: "ex-config-1",
    orderId: "ord-abc",
    symbol: "BTC/USDT",
    status: "placed",
    settledAt: null,
    requestedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago — old enough
    ...overrides,
  };
}

function buildDbMock(selectRows: unknown[]) {
  const updateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
  const dbUpdate = vi.fn(() => ({ set: updateSet }));

  const dbSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(selectRows),
    })),
  }));

  return { select: dbSelect, update: dbUpdate, _updateSet: updateSet };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("reconcileOpenOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a placed order when the exchange reports it as filled", async () => {
    const record = makeRecord();
    const db = buildDbMock([record]);

    const exchangeManager = {
      fetchOrder: vi
        .fn()
        .mockResolvedValue({ id: "ord-abc", symbol: "BTC/USDT", status: "filled" }),
    } as unknown as Parameters<typeof reconcileOpenOrders>[1];

    const result = await reconcileOpenOrders(db as never, exchangeManager);

    expect(result.checked).toBe(1);
    expect(result.stuck).toBe(1);
    expect(result.updated).toBe(1);

    // The update chain should have been called
    expect(db.update).toHaveBeenCalledWith(expect.anything());
    const setCall = db._updateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall).toBeDefined();
    expect(setCall["settledAt"]).toBeInstanceOf(Date);
  });

  it("marks an order 'failed' when the exchange reports it as not found", async () => {
    const record = makeRecord();
    const db = buildDbMock([record]);

    const notFoundError = new Error("order not found on exchange");
    const exchangeManager = {
      fetchOrder: vi.fn().mockRejectedValue(notFoundError),
    } as unknown as Parameters<typeof reconcileOpenOrders>[1];

    const result = await reconcileOpenOrders(db as never, exchangeManager);

    expect(result.checked).toBe(1);
    expect(result.stuck).toBe(1);
    expect(result.updated).toBe(1);

    const setCall = db._updateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall).toBeDefined();
    expect(setCall["status"]).toBe("failed");
    expect(setCall["errorMessage"]).toBe("not found on exchange after restart");
  });

  it("skips a recently placed order (< 5 minutes old)", async () => {
    // requestedAt is only 1 min ago — within the 5-min grace window
    // The drizzle `lt(orderAuditLog.requestedAt, cutoff)` filter excludes it,
    // so the mock returns no candidates.
    const db = buildDbMock([]); // ← no rows returned

    const exchangeManager = {
      fetchOrder: vi.fn(),
    } as unknown as Parameters<typeof reconcileOpenOrders>[1];

    const result = await reconcileOpenOrders(db as never, exchangeManager);

    expect(result.checked).toBe(0);
    expect(result.stuck).toBe(0);
    expect(result.updated).toBe(0);
    expect(exchangeManager.fetchOrder).not.toHaveBeenCalled();
  });

  it("skips an order and leaves it unchanged when the exchange fetch errors (non-404)", async () => {
    const record = makeRecord();
    const db = buildDbMock([record]);

    const transientError = new Error("connection timeout");
    const exchangeManager = {
      fetchOrder: vi.fn().mockRejectedValue(transientError),
    } as unknown as Parameters<typeof reconcileOpenOrders>[1];

    const result = await reconcileOpenOrders(db as never, exchangeManager);

    expect(result.checked).toBe(1);
    expect(result.stuck).toBe(0);
    expect(result.updated).toBe(0);
    // db.update should NOT have been called for a transient error
    expect(db.update).not.toHaveBeenCalled();
  });

  it("updates a cancelled order when the exchange reports it as cancelled", async () => {
    const record = makeRecord();
    const db = buildDbMock([record]);

    const exchangeManager = {
      fetchOrder: vi.fn().mockResolvedValue({
        id: "ord-abc",
        symbol: "BTC/USDT",
        status: "cancelled",
      }),
    } as unknown as Parameters<typeof reconcileOpenOrders>[1];

    const result = await reconcileOpenOrders(db as never, exchangeManager);

    expect(result.checked).toBe(1);
    expect(result.stuck).toBe(1);
    expect(result.updated).toBe(1);

    const setCall = db._updateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall["status"]).toBe("cancelled");
    expect(setCall["settledAt"]).toBeInstanceOf(Date);
  });

  it("leaves an order untouched when the exchange reports it as still open", async () => {
    const record = makeRecord();
    const db = buildDbMock([record]);

    const exchangeManager = {
      fetchOrder: vi.fn().mockResolvedValue({
        id: "ord-abc",
        symbol: "BTC/USDT",
        status: "open",
      }),
    } as unknown as Parameters<typeof reconcileOpenOrders>[1];

    const result = await reconcileOpenOrders(db as never, exchangeManager);

    expect(result.checked).toBe(1);
    expect(result.stuck).toBe(0);
    expect(result.updated).toBe(0);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("handles multiple candidates independently", async () => {
    const filled = makeRecord({ id: "rec-1", orderId: "ord-1" });
    const missing = makeRecord({ id: "rec-2", orderId: "ord-2" });
    const open = makeRecord({ id: "rec-3", orderId: "ord-3" });

    const db = buildDbMock([filled, missing, open]);
    const updateWhereMock = vi.fn().mockResolvedValue([]);
    db._updateSet.mockReturnValue({ where: updateWhereMock });

    const exchangeManager = {
      fetchOrder: vi
        .fn()
        .mockResolvedValueOnce({ id: "ord-1", symbol: "BTC/USDT", status: "filled" })
        .mockRejectedValueOnce(new Error("invalid order"))
        .mockResolvedValueOnce({ id: "ord-3", symbol: "BTC/USDT", status: "open" }),
    } as unknown as Parameters<typeof reconcileOpenOrders>[1];

    const result = await reconcileOpenOrders(db as never, exchangeManager);

    expect(result.checked).toBe(3);
    expect(result.stuck).toBe(2); // filled + not-found
    expect(result.updated).toBe(2);
    expect(db.update).toHaveBeenCalledTimes(2);
  });
});
