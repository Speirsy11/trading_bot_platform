export type ResearchTimeframeFilter = "all" | "15m" | "1h" | "4h";

const RESEARCH_TIMEFRAMES = new Set<ResearchTimeframeFilter>(["15m", "1h", "4h"]);

export type ResearchRouteContext = {
  symbol: string | null;
  timeframe: ResearchTimeframeFilter | null;
  timeframeFilter: ResearchTimeframeFilter;
  hasChartContext: boolean;
};

export function buildResearchRouteContext(input: {
  symbol?: string | null;
  timeframe?: string | null;
}): ResearchRouteContext {
  const symbol = normalizeResearchSymbol(input.symbol);
  const timeframe = normalizeResearchTimeframe(input.timeframe);

  return {
    symbol,
    timeframe,
    timeframeFilter: timeframe ?? "all",
    hasChartContext: Boolean(symbol || timeframe),
  };
}

export function normalizeResearchSymbol(value?: string | null) {
  const symbol = value?.trim().toUpperCase();
  return symbol && /^[A-Z0-9]+\/[A-Z0-9]+$/.test(symbol) ? symbol : null;
}

export function normalizeResearchTimeframe(value?: string | null): ResearchTimeframeFilter | null {
  const timeframe = value?.trim() as ResearchTimeframeFilter | undefined;
  return timeframe && RESEARCH_TIMEFRAMES.has(timeframe) ? timeframe : null;
}
