export type ResearchAuditCoverage = {
  earliest?: string | null;
  latest?: string | null;
  totalCandles?: number | null;
};

export type ResearchAuditSymbolResult = {
  symbol: string;
  candles?: number;
  error?: string;
  coverage?: ResearchAuditCoverage;
  splits?: {
    train?: unknown;
    validation?: unknown;
    test?: unknown;
  };
};

export type ResearchEvidenceAuditInput = {
  perSymbol: ResearchAuditSymbolResult[];
  qualified: boolean;
  alphaQualified: boolean;
  paperBotEligible: boolean;
  qualificationReasons: string[];
};

export function summarizeResearchEvidenceAudit(input: ResearchEvidenceAuditInput) {
  const symbolCount = input.perSymbol.length;
  const failedSymbols = input.perSymbol.filter(
    (row) => Boolean(row.error) || !row.splits?.test
  ).length;
  const completeSymbols = Math.max(symbolCount - failedSymbols, 0);
  const totalCandles = input.perSymbol.reduce(
    (sum, row) => sum + (row.coverage?.totalCandles ?? row.candles ?? 0),
    0
  );
  const coverageStarts = parseTimes(input.perSymbol.map((row) => row.coverage?.earliest ?? null));
  const coverageEnds = parseTimes(input.perSymbol.map((row) => row.coverage?.latest ?? null));
  const gateBlockers = input.qualificationReasons.filter(
    (reason) => !/^passed\b/i.test(reason.trim())
  );

  return {
    symbolCount,
    completeSymbols,
    failedSymbols,
    totalCandles,
    earliestCoverage: coverageStarts.length > 0 ? new Date(Math.min(...coverageStarts)) : null,
    latestCoverage: coverageEnds.length > 0 ? new Date(Math.max(...coverageEnds)) : null,
    gateBlockers,
    gateStatus: input.qualified ? "passed" : "blocked",
    promotionStatus: input.paperBotEligible
      ? input.alphaQualified
        ? "alpha-qualified"
        : "paper-eligible"
      : "locked",
  };
}

function parseTimes(values: Array<string | null>) {
  return values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter(Number.isFinite);
}
