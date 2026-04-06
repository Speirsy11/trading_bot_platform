import { describe, it, expect, beforeEach } from "vitest";

import { StrategyRegistry } from "./StrategyRegistry";
import { RSIMeanReversion } from "./strategies/RSIMeanReversion";
import { SMACrossover } from "./strategies/SMACrossover";

describe("StrategyRegistry", () => {
  beforeEach(() => {
    StrategyRegistry.clear();
  });

  it("registers and creates a strategy", () => {
    StrategyRegistry.register("sma-crossover", () => new SMACrossover());
    expect(StrategyRegistry.has("sma-crossover")).toBe(true);
    const strat = StrategyRegistry.create("sma-crossover");
    expect(strat.name).toBe("SMA Crossover");
  });

  it("lists registered strategies", () => {
    StrategyRegistry.register("sma-crossover", () => new SMACrossover());
    StrategyRegistry.register("rsi-mean-reversion", () => new RSIMeanReversion());
    expect(StrategyRegistry.list()).toEqual(["sma-crossover", "rsi-mean-reversion"]);
  });

  it("throws on unregistered strategy", () => {
    expect(() => StrategyRegistry.create("unknown")).toThrow('Strategy "unknown" not found');
  });

  it("clears all strategies", () => {
    StrategyRegistry.register("sma-crossover", () => new SMACrossover());
    StrategyRegistry.clear();
    expect(StrategyRegistry.list()).toHaveLength(0);
  });
});
