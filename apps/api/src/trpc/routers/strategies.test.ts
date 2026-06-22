import { StrategyRegistry } from "@tb/trading-core";
import { describe, expect, it } from "vitest";

import { bootstrapStrategies, getStrategyCatalog } from "../../services/strategyCatalog";
import { createTrpcContext } from "../context";
import { createCaller } from "../router";

describe("strategies router", () => {
  it("exposes launch presets backed by executable spot research strategies", async () => {
    bootstrapStrategies();
    const caller = createCaller(
      createTrpcContext({
        db: {} as never,
        redis: {} as never,
        queues: {} as never,
        exchangeManager: {} as never,
        marketData: {} as never,
        keyVault: {} as never,
        exportsDir: "/tmp/exports",
      })
    );

    const catalog = await caller.strategies.catalog();
    const researchStrategyKeys = new Set([
      "sma-crossover",
      "sma-chandelier-trend",
      "rsi-mean-reversion",
      "bollinger-long-bounce",
      "donchian-breakout",
      "ema-atr-trend",
      "macd-momentum",
      "chandelier-trend",
    ]);

    for (const preset of catalog.presets) {
      expect(researchStrategyKeys.has(preset.strategy)).toBe(true);
      const strategy = StrategyRegistry.create(preset.strategy);
      expect(() => strategy.paramsSchema.parse(preset.strategyParams)).not.toThrow();
    }

    const visibleKeys = new Set(catalog.strategies.map((strategy) => strategy.key));
    for (const key of researchStrategyKeys) {
      expect(visibleKeys.has(key)).toBe(true);
    }
    expect(visibleKeys.has("bollinger-bounce")).toBe(false);
    expect(visibleKeys.has("sentiment-aware-sma-crossover")).toBe(false);

    expect(catalog.strategies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "macd-momentum",
          visibility: "launchable",
          marketMode: "spot",
          researchBacked: true,
        }),
        expect.objectContaining({
          key: "chandelier-trend",
          visibility: "launchable",
          marketMode: "spot",
          researchBacked: true,
        }),
        expect.objectContaining({
          key: "sma-chandelier-trend",
          visibility: "launchable",
          marketMode: "spot",
          researchBacked: true,
        }),
      ])
    );

    const sma = catalog.strategies.find((strategy) => strategy.key === "sma-crossover");
    expect(sma?.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "fastPeriod",
          inputType: "number",
          defaultValue: 9,
          min: 2,
          max: 200,
          integer: true,
        }),
      ])
    );

    const bollinger = catalog.strategies.find(
      (strategy) => strategy.key === "bollinger-long-bounce"
    );
    expect(bollinger?.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "exitBand",
          inputType: "select",
          options: ["middle", "upper"],
          defaultValue: "middle",
        }),
      ])
    );
  });

  it("keeps legacy strategies registered for existing saved configs", () => {
    bootstrapStrategies();

    const legacyCatalog = getStrategyCatalog({ includeLegacy: true });
    const visibleCatalog = getStrategyCatalog();

    expect(visibleCatalog.some((strategy) => strategy.key === "bollinger-bounce")).toBe(false);
    expect(legacyCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "bollinger-bounce",
          visibility: "legacy",
          marketMode: "margin",
          researchBacked: false,
        }),
      ])
    );
    expect(() => StrategyRegistry.create("bollinger-bounce")).not.toThrow();
  });
});
