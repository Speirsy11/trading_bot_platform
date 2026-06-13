import { describe, expect, it } from "vitest";

import {
  coerceStrategyParamInput,
  formatStrategyParamLabel,
  getDefaultStrategyParams,
  isNumberStrategyParam,
  mergeStrategyParamValue,
  type StrategyParamDefinition,
} from "./strategyParams";

describe("strategy param helpers", () => {
  it("builds default params without dropping falsey configured values", () => {
    const params: StrategyParamDefinition[] = [
      { name: "fastPeriod", defaultValue: 9 },
      { name: "exitBand", defaultValue: "upper" },
      { name: "enabled", defaultValue: false },
      { name: "atrStop", defaultValue: 0 },
      { name: "unset" },
    ];

    expect(getDefaultStrategyParams(params)).toEqual({
      fastPeriod: 9,
      exitBand: "upper",
      enabled: false,
      atrStop: 0,
    });
  });

  it("merges edited params and removes blank values so strategy defaults can apply", () => {
    expect(mergeStrategyParamValue({ fastPeriod: 9, exitBand: "upper" }, "exitBand", "")).toEqual({
      fastPeriod: 9,
    });
    expect(mergeStrategyParamValue({ fastPeriod: 9 }, "exitBand", "middle")).toEqual({
      fastPeriod: 9,
      exitBand: "middle",
    });
  });

  it("coerces numeric catalog params while preserving select values", () => {
    expect(coerceStrategyParamInput({ name: "fastPeriod", inputType: "number" }, "50")).toBe(50);
    expect(coerceStrategyParamInput({ name: "stdDevMultiplier", defaultValue: 2 }, "2.5")).toBe(
      2.5
    );
    expect(
      coerceStrategyParamInput(
        { name: "exitBand", inputType: "select", options: ["middle", "upper"] },
        "upper"
      )
    ).toBe("upper");
  });

  it("labels params for dense trading forms", () => {
    expect(formatStrategyParamLabel("rsiOversold")).toBe("RSI Oversold");
    expect(formatStrategyParamLabel("emaAtrTrend")).toBe("EMA ATR Trend");
    expect(isNumberStrategyParam({ name: "period", inputType: "number" })).toBe(true);
    expect(isNumberStrategyParam({ name: "exitBand", inputType: "select" })).toBe(false);
  });
});
