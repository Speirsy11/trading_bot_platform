import { describe, it, expect } from "vitest";

import { IndicatorCalculator } from "./calculator";

describe("IndicatorCalculator", () => {
  const calc = new IndicatorCalculator();

  it("exposes all indicator methods", () => {
    expect(typeof calc.sma).toBe("function");
    expect(typeof calc.ema).toBe("function");
    expect(typeof calc.rsi).toBe("function");
    expect(typeof calc.macd).toBe("function");
    expect(typeof calc.adx).toBe("function");
    expect(typeof calc.stochastic).toBe("function");
    expect(typeof calc.bollingerBands).toBe("function");
    expect(typeof calc.atr).toBe("function");
    expect(typeof calc.obv).toBe("function");
    expect(typeof calc.vwap).toBe("function");
  });

  it("calculates SMA via calculator", () => {
    const result = calc.sma([10, 20, 30, 40, 50], 3);
    expect(result).toEqual([20, 30, 40]);
  });

  it("calculates RSI via calculator", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = calc.rsi(closes, 14);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toBe(100);
  });
});
