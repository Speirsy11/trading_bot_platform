import { describe, expect, it } from "vitest";

import {
  buildResearchRouteContext,
  normalizeResearchSymbol,
  normalizeResearchTimeframe,
} from "./researchRouteState";

describe("researchRouteState", () => {
  it("normalizes chart context for research leaderboard handoffs", () => {
    expect(
      buildResearchRouteContext({
        symbol: "btc/usdt",
        timeframe: "1h",
      })
    ).toEqual({
      symbol: "BTC/USDT",
      timeframe: "1h",
      timeframeFilter: "1h",
      hasChartContext: true,
    });
  });

  it("ignores unsupported manual intervals while preserving valid symbols", () => {
    expect(
      buildResearchRouteContext({
        symbol: "ETH/USDT",
        timeframe: "5m",
      })
    ).toEqual({
      symbol: "ETH/USDT",
      timeframe: null,
      timeframeFilter: "all",
      hasChartContext: true,
    });
    expect(normalizeResearchTimeframe("1d")).toBeNull();
  });

  it("rejects malformed symbols", () => {
    expect(normalizeResearchSymbol("BTCUSDT")).toBeNull();
    expect(normalizeResearchSymbol(" BTC/USDT ")).toBe("BTC/USDT");
  });
});
