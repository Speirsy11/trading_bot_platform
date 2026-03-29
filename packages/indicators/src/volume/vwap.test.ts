import { describe, it, expect } from "vitest";

import { vwap } from "../volume/vwap.js";

describe("VWAP", () => {
  it("calculates VWAP correctly", () => {
    const candles = [
      { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
      { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 200 },
      { time: 3, open: 12, high: 14, low: 11, close: 13, volume: 150 },
    ];

    const result = vwap(candles);
    expect(result).toHaveLength(3);

    // First VWAP = typical price = (12+9+11)/3 = 10.667
    const tp1 = (12 + 9 + 11) / 3;
    expect(result[0]).toBeCloseTo(tp1, 4);

    // Second VWAP = (tp1*100 + tp2*200) / (100+200)
    const tp2 = (13 + 10 + 12) / 3;
    const expectedVwap2 = (tp1 * 100 + tp2 * 200) / 300;
    expect(result[1]).toBeCloseTo(expectedVwap2, 4);
  });

  it("returns empty for empty input", () => {
    expect(vwap([])).toHaveLength(0);
  });
});
