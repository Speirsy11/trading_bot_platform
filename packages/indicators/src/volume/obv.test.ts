import { describe, it, expect } from "vitest";

import { obv } from "../volume/obv.js";

describe("OBV", () => {
  it("calculates OBV correctly", () => {
    const closes = [10, 11, 10.5, 12, 11.5, 13, 12.5];
    const volumes = [100, 200, 150, 300, 250, 400, 350];

    const result = obv(closes, volumes);

    expect(result).toHaveLength(7);
    expect(result[0]).toBe(100); // First value = first volume
    expect(result[1]).toBe(300); // 11 > 10 → +200
    expect(result[2]).toBe(150); // 10.5 < 11 → -150
    expect(result[3]).toBe(450); // 12 > 10.5 → +300
    expect(result[4]).toBe(200); // 11.5 < 12 → -250
    expect(result[5]).toBe(600); // 13 > 11.5 → +400
    expect(result[6]).toBe(250); // 12.5 < 13 → -350
  });

  it("handles equal closes (no change)", () => {
    const closes = [10, 10, 10];
    const volumes = [100, 200, 300];
    const result = obv(closes, volumes);
    expect(result).toEqual([100, 100, 100]);
  });

  it("returns empty for empty input", () => {
    expect(obv([], [])).toHaveLength(0);
  });
});
