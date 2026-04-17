import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDailyLossLimit, getDailyPnL, hasExceededDailyLossLimit } from "./dailyLossCheck";

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

type TradeRow = { pnl: string | null };
type BotRow = { riskConfig: unknown };

/**
 * Creates a minimal chainable Drizzle-like select builder that resolves to `rows`.
 */
function makeSelectBuilder<T>(rows: T[]) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b["from"] = chain;
  b["where"] = chain;
  b["orderBy"] = chain;
  b["limit"] = chain;
  b["then"] = (resolve: (value: T[]) => unknown) => Promise.resolve(rows).then(resolve);
  return b;
}

function createDbMock(selectQueues: unknown[][]) {
  const queue = [...selectQueues];
  return {
    select: vi.fn(() => makeSelectBuilder(queue.shift() ?? [])),
  };
}

// ---------------------------------------------------------------------------
// getDailyPnL
// ---------------------------------------------------------------------------

describe("getDailyPnL", () => {
  it("returns 0 when there are no trades", async () => {
    const db = createDbMock([[]]);
    const result = await getDailyPnL(db as never, "bot-1");
    expect(result).toBe(0);
  });

  it("sums negative PnL trades and returns the negative total", async () => {
    const trades: TradeRow[] = [{ pnl: "-100.00" }, { pnl: "-50.50" }, { pnl: "-25.00" }];
    const db = createDbMock([trades]);
    const result = await getDailyPnL(db as never, "bot-1");
    expect(result).toBeCloseTo(-175.5);
  });

  it("returns 0 when the day is profitable", async () => {
    const trades: TradeRow[] = [{ pnl: "200.00" }, { pnl: "50.00" }];
    const db = createDbMock([trades]);
    const result = await getDailyPnL(db as never, "bot-1");
    expect(result).toBe(0);
  });

  it("returns 0 when net PnL is exactly zero", async () => {
    const trades: TradeRow[] = [{ pnl: "100.00" }, { pnl: "-100.00" }];
    const db = createDbMock([trades]);
    const result = await getDailyPnL(db as never, "bot-1");
    expect(result).toBe(0);
  });

  it("treats null pnl as 0", async () => {
    const trades: TradeRow[] = [{ pnl: null }, { pnl: "-80.00" }];
    const db = createDbMock([trades]);
    const result = await getDailyPnL(db as never, "bot-1");
    expect(result).toBeCloseTo(-80);
  });

  it("returns 0 when mixed trades result in a small gain", async () => {
    const trades: TradeRow[] = [{ pnl: "-300.00" }, { pnl: "350.00" }];
    const db = createDbMock([trades]);
    const result = await getDailyPnL(db as never, "bot-1");
    // Net +50, so no loss — should return 0
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getDailyLossLimit
// ---------------------------------------------------------------------------

describe("getDailyLossLimit", () => {
  beforeEach(() => {
    delete process.env["DAILY_LOSS_LIMIT_USD"];
  });
  afterEach(() => {
    delete process.env["DAILY_LOSS_LIMIT_USD"];
  });

  it("returns the per-bot limit from riskConfig when set", async () => {
    const botRows: BotRow[] = [{ riskConfig: { dailyLossLimitUSD: 250 } }];
    const db = createDbMock([botRows]);
    const limit = await getDailyLossLimit(db as never, "bot-1");
    expect(limit).toBe(250);
  });

  it("falls back to DAILY_LOSS_LIMIT_USD env var when riskConfig has no limit", async () => {
    process.env["DAILY_LOSS_LIMIT_USD"] = "500";
    const botRows: BotRow[] = [{ riskConfig: {} }];
    const db = createDbMock([botRows]);
    const limit = await getDailyLossLimit(db as never, "bot-1");
    expect(limit).toBe(500);
  });

  it("returns Infinity when neither per-bot config nor env var is set", async () => {
    const botRows: BotRow[] = [{ riskConfig: {} }];
    const db = createDbMock([botRows]);
    const limit = await getDailyLossLimit(db as never, "bot-1");
    expect(limit).toBe(Infinity);
  });

  it("returns Infinity when bot row is not found", async () => {
    const db = createDbMock([[]]); // no rows
    const limit = await getDailyLossLimit(db as never, "bot-missing");
    expect(limit).toBe(Infinity);
  });

  it("ignores a non-positive dailyLossLimitUSD in riskConfig", async () => {
    process.env["DAILY_LOSS_LIMIT_USD"] = "300";
    const botRows: BotRow[] = [{ riskConfig: { dailyLossLimitUSD: 0 } }];
    const db = createDbMock([botRows]);
    const limit = await getDailyLossLimit(db as never, "bot-1");
    // 0 is not a valid positive limit — should fall back to env var
    expect(limit).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// hasExceededDailyLossLimit
// ---------------------------------------------------------------------------

describe("hasExceededDailyLossLimit", () => {
  beforeEach(() => {
    delete process.env["DAILY_LOSS_LIMIT_USD"];
  });
  afterEach(() => {
    delete process.env["DAILY_LOSS_LIMIT_USD"];
  });

  it("returns true when loss exceeds the configured limit", async () => {
    process.env["DAILY_LOSS_LIMIT_USD"] = "500";
    const trades: TradeRow[] = [{ pnl: "-600.00" }];
    const botRows: BotRow[] = [{ riskConfig: {} }];
    // getDailyPnL calls select once, getDailyLossLimit calls select once
    const db = createDbMock([trades, botRows]);
    expect(await hasExceededDailyLossLimit(db as never, "bot-1")).toBe(true);
  });

  it("returns false when loss is within the limit", async () => {
    process.env["DAILY_LOSS_LIMIT_USD"] = "500";
    const trades: TradeRow[] = [{ pnl: "-200.00" }];
    const botRows: BotRow[] = [{ riskConfig: {} }];
    const db = createDbMock([trades, botRows]);
    expect(await hasExceededDailyLossLimit(db as never, "bot-1")).toBe(false);
  });

  it("returns false when there are no trades", async () => {
    process.env["DAILY_LOSS_LIMIT_USD"] = "500";
    const botRows: BotRow[] = [{ riskConfig: {} }];
    const db = createDbMock([[], botRows]);
    expect(await hasExceededDailyLossLimit(db as never, "bot-1")).toBe(false);
  });

  it("returns false when the day is profitable", async () => {
    process.env["DAILY_LOSS_LIMIT_USD"] = "500";
    const trades: TradeRow[] = [{ pnl: "300.00" }];
    const botRows: BotRow[] = [{ riskConfig: {} }];
    const db = createDbMock([trades, botRows]);
    expect(await hasExceededDailyLossLimit(db as never, "bot-1")).toBe(false);
  });

  it("returns false when no limit is configured (Infinity)", async () => {
    // no env var, no riskConfig limit
    const trades: TradeRow[] = [{ pnl: "-99999.00" }];
    const botRows: BotRow[] = [{ riskConfig: {} }];
    const db = createDbMock([trades, botRows]);
    expect(await hasExceededDailyLossLimit(db as never, "bot-1")).toBe(false);
  });

  it("uses the per-bot limit over the env var", async () => {
    process.env["DAILY_LOSS_LIMIT_USD"] = "1000";
    // per-bot limit is tighter: $100
    const trades: TradeRow[] = [{ pnl: "-150.00" }];
    const botRows: BotRow[] = [{ riskConfig: { dailyLossLimitUSD: 100 } }];
    const db = createDbMock([trades, botRows]);
    expect(await hasExceededDailyLossLimit(db as never, "bot-1")).toBe(true);
  });

  it("returns false when loss exactly equals the limit (not exceeded)", async () => {
    process.env["DAILY_LOSS_LIMIT_USD"] = "500";
    const trades: TradeRow[] = [{ pnl: "-500.00" }];
    const botRows: BotRow[] = [{ riskConfig: {} }];
    const db = createDbMock([trades, botRows]);
    // exactly at the limit — not *exceeded*
    expect(await hasExceededDailyLossLimit(db as never, "bot-1")).toBe(false);
  });
});
