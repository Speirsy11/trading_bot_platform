import { describe, expect, it } from "vitest";

import {
  RESEARCH_HANDOFF_DEFAULTS,
  buildResearchBacktestHref,
  buildResearchBotHref,
  resolveResearchExecutionAssumptions,
  selectResearchReplayCoverage,
} from "./researchHandoff";

const source = {
  id: "43ff12fb-d236-4f91-b877-f5db9ecd145b",
  strategy: "sma-crossover",
  strategyName: "SMA Crossover",
  strategyParams: { fastPeriod: 50, slowPeriod: 200 },
  timeframe: "15m",
  dataCoverage: [
    {
      symbol: "ETH/USDT",
      earliest: "2020-01-01T00:00:00.000Z",
      latest: "2026-01-01T00:00:00.000Z",
      totalCandles: 100,
    },
    {
      symbol: "BTC/USDT",
      earliest: "2017-08-17T04:00:00.000Z",
      latest: "2026-05-30T20:00:00.000Z",
      totalCandles: 200,
    },
  ],
};

describe("research handoff urls", () => {
  it("selects BTC coverage for single-symbol research replays when available", () => {
    expect(selectResearchReplayCoverage(source.dataCoverage)).toMatchObject({
      symbol: "BTC/USDT",
      earliest: "2017-08-17T04:00:00.000Z",
    });
  });

  it("builds a manual backtest href with reproducible research execution assumptions", () => {
    const href = buildResearchBacktestHref(source);
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/backtest");
    expect(url.searchParams.get("strategy")).toBe("sma-crossover");
    expect(JSON.parse(url.searchParams.get("strategyParams") ?? "{}")).toEqual({
      fastPeriod: 50,
      slowPeriod: 200,
    });
    expect(url.searchParams.get("symbol")).toBe("BTC/USDT");
    expect(url.searchParams.get("timeframe")).toBe("15m");
    expect(url.searchParams.get("sourceResearch")).toBe(source.id);
    expect(url.searchParams.get("initialBalance")).toBe("10000");
    expect(url.searchParams.get("makerFee")).toBe("0.001");
    expect(url.searchParams.get("takerFee")).toBe("0.001");
    expect(url.searchParams.get("slippagePct")).toBe("0.0005");
    expect(url.searchParams.get("startTime")).toBe(String(Date.parse("2017-08-17T04:00:00.000Z")));
    expect(url.searchParams.get("endTime")).toBe(String(Date.parse("2026-05-30T20:00:00.000Z")));
  });

  it("builds a paper bot draft href with conservative risk caps and source evidence", () => {
    const href = buildResearchBotHref({ ...source, dataCoverage: [] });
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/bots/new");
    expect(url.searchParams.get("mode")).toBe("paper");
    expect(url.searchParams.get("symbol")).toBe(RESEARCH_HANDOFF_DEFAULTS.preferredSymbol);
    expect(url.searchParams.get("sourceResearch")).toBe(source.id);
    expect(url.searchParams.get("balance")).toBe("10000");
    expect(JSON.parse(url.searchParams.get("riskConfig") ?? "{}")).toEqual(
      RESEARCH_HANDOFF_DEFAULTS.paperRiskConfig
    );
  });

  it("uses persisted execution assumptions for backtest and paper-bot handoff links", () => {
    const executionAssumptions = {
      marketMode: "spot",
      initialBalance: 25_000,
      fees: { maker: 0.0008, taker: 0.0012 },
      slippage: { enabled: true, percentage: 0.0007 },
    };

    const backtestUrl = new URL(
      buildResearchBacktestHref({ ...source, executionAssumptions }),
      "http://localhost"
    );
    const botUrl = new URL(
      buildResearchBotHref({ ...source, executionAssumptions }),
      "http://localhost"
    );

    expect(backtestUrl.searchParams.get("initialBalance")).toBe("25000");
    expect(backtestUrl.searchParams.get("makerFee")).toBe("0.0008");
    expect(backtestUrl.searchParams.get("takerFee")).toBe("0.0012");
    expect(backtestUrl.searchParams.get("slippagePct")).toBe("0.0007");
    expect(botUrl.searchParams.get("balance")).toBe("25000");
  });

  it("normalizes missing execution assumptions to the research defaults", () => {
    expect(resolveResearchExecutionAssumptions(undefined)).toEqual({
      marketMode: "spot",
      initialBalance: 10_000,
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: true, percentage: 0.0005 },
    });
  });
});
