import { describe, it, expect, beforeEach } from "vitest";

import { PerformanceTracker } from "./PerformanceTracker.js";

describe("PerformanceTracker", () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  it("records equity points", () => {
    tracker.record(1000, 10000);
    tracker.record(2000, 10500);
    const curve = tracker.getEquityCurve();
    expect(curve).toHaveLength(2);
    expect(curve[0]).toEqual({ time: 1000, equity: 10000 });
    expect(curve[1]).toEqual({ time: 2000, equity: 10500 });
  });

  it("gets last equity", () => {
    tracker.record(1000, 10000);
    tracker.record(2000, 10500);
    expect(tracker.getLastEquity()).toBe(10500);
  });

  it("returns 0 for empty last equity", () => {
    expect(tracker.getLastEquity()).toBe(0);
  });

  it("computes drawdown curve", () => {
    tracker.record(1000, 10000);
    tracker.record(2000, 11000); // new peak
    tracker.record(3000, 9900); // drawdown
    tracker.record(4000, 11000); // recovery

    const dd = tracker.getDrawdownCurve();
    expect(dd).toHaveLength(4);
    expect(dd[0]!.equity).toBe(0); // first point, no drawdown
    expect(dd[1]!.equity).toBe(0); // at peak
    expect(dd[2]!.equity).toBeCloseTo(10, 1); // ~10% drawdown from 11000
    expect(dd[3]!.equity).toBe(0); // back at peak
  });

  it("computes daily returns", () => {
    // Day 1
    const day1Start = new Date("2024-01-01T09:00:00Z").getTime();
    const day1End = new Date("2024-01-01T16:00:00Z").getTime();
    tracker.record(day1Start, 10000);
    tracker.record(day1End, 10500);

    // Day 2
    const day2Start = new Date("2024-01-02T09:00:00Z").getTime();
    const day2End = new Date("2024-01-02T16:00:00Z").getTime();
    tracker.record(day2Start, 10500);
    tracker.record(day2End, 10200);

    const dailyReturns = tracker.getDailyReturns();
    expect(dailyReturns).toHaveLength(2);
    expect(dailyReturns[0]).toBeCloseTo(0.05, 4); // +5%
    expect(dailyReturns[1]).toBeCloseTo(-0.02857, 3); // -2.86%
  });

  it("resets state", () => {
    tracker.record(1000, 10000);
    tracker.reset();
    expect(tracker.getEquityCurve()).toHaveLength(0);
    expect(tracker.getDailyReturns()).toHaveLength(0);
  });
});
