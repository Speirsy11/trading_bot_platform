import { describe, expect, it } from "vitest";

import { summarizeResearchEvidenceAudit } from "./researchEvidenceAudit";

describe("research evidence audit", () => {
  it("summarizes source coverage, failed symbols, gates, and promotion status", () => {
    const audit = summarizeResearchEvidenceAudit({
      perSymbol: [
        {
          symbol: "BTC/USDT",
          candles: 100,
          coverage: {
            earliest: "2020-01-01T00:00:00.000Z",
            latest: "2026-01-01T00:00:00.000Z",
            totalCandles: 100,
          },
          splits: { train: {}, validation: {}, test: {} },
        },
        {
          symbol: "ETH/USDT",
          candles: 80,
          coverage: {
            earliest: "2021-01-01T00:00:00.000Z",
            latest: "2025-12-01T00:00:00.000Z",
            totalCandles: 80,
          },
          error: "Need at least 90 candles",
          splits: {},
        },
      ],
      qualified: false,
      alphaQualified: false,
      paperBotEligible: false,
      qualificationReasons: [
        "Out-of-sample return is not positive",
        "Fewer than 30 out-of-sample trades",
      ],
    });

    expect(audit).toMatchObject({
      symbolCount: 2,
      completeSymbols: 1,
      failedSymbols: 1,
      totalCandles: 180,
      gateStatus: "blocked",
      promotionStatus: "locked",
      gateBlockers: ["Out-of-sample return is not positive", "Fewer than 30 out-of-sample trades"],
    });
    expect(audit.earliestCoverage?.toISOString()).toBe("2020-01-01T00:00:00.000Z");
    expect(audit.latestCoverage?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("does not treat the pass reason as a gate blocker", () => {
    const audit = summarizeResearchEvidenceAudit({
      perSymbol: [{ symbol: "BTC/USDT", splits: { test: {} } }],
      qualified: true,
      alphaQualified: true,
      paperBotEligible: true,
      qualificationReasons: ["Passed validation and out-of-sample robustness gates"],
    });

    expect(audit.gateStatus).toBe("passed");
    expect(audit.gateBlockers).toEqual([]);
    expect(audit.promotionStatus).toBe("alpha-qualified");
  });
});
