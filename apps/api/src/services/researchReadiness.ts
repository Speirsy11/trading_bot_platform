import { timeframeToMs } from "@tb/trading-core";

import type { MarketDataReader, MarketQualityMetric } from "./harvesterMarketData";
import { RESEARCH_SYMBOLS, RESEARCH_TIMEFRAMES } from "./researchEngine";

export type ResearchDataReadinessStatus = "ready" | "running" | "pending" | "missing";

export type ResearchDataReadinessItem = {
  exchange: string;
  symbol: string;
  timeframe: string;
  status: ResearchDataReadinessStatus;
  sourceStatus: string | null;
  totalCandles: number;
  earliest: string | null;
  latest: string | null;
  nextStartTime: string | null;
  latestAvailableTime: string | null;
  lastUpdated: string | null;
};

export type ResearchDataReadinessSummary = {
  exchange: string;
  ready: boolean;
  total: number;
  readyCount: number;
  blockingCount: number;
  runningCount: number;
  pendingCount: number;
  missingCount: number;
  latestUpdated: string | null;
  items: ResearchDataReadinessItem[];
  blockingItems: ResearchDataReadinessItem[];
};

export function summarizeResearchDataReadiness(
  metrics: MarketQualityMetric[],
  options: {
    exchange?: string;
    symbols?: string[];
    timeframes?: string[];
  } = {}
): ResearchDataReadinessSummary {
  const exchange = options.exchange ?? "binance";
  const symbols = options.symbols ?? [...RESEARCH_SYMBOLS];
  const timeframes = options.timeframes ?? [...RESEARCH_TIMEFRAMES];
  const metricBySymbolTimeframe = new Map(
    metrics.map((metric) => [metricKey(metric.symbol, metric.timeframe), metric])
  );

  const items = symbols.flatMap((symbol) =>
    timeframes.map((timeframe) => {
      const metric = metricBySymbolTimeframe.get(metricKey(symbol, timeframe));
      const status = classifyMetric(metric);
      return {
        exchange,
        symbol,
        timeframe,
        status,
        sourceStatus: metric?.status ?? null,
        totalCandles: metric?.totalCandles ?? 0,
        earliest: metric?.earliest ?? null,
        latest: metric?.latest ?? null,
        nextStartTime: metric?.nextStartTime ?? null,
        latestAvailableTime: metric?.latestAvailableTime ?? null,
        lastUpdated: metric?.lastUpdated ?? null,
      };
    })
  );

  const blockingItems = items.filter((item) => item.status !== "ready");
  const latestUpdated = maxIsoDate(items.map((item) => item.lastUpdated));

  return {
    exchange,
    ready: blockingItems.length === 0,
    total: items.length,
    readyCount: items.filter((item) => item.status === "ready").length,
    blockingCount: blockingItems.length,
    runningCount: items.filter((item) => item.status === "running").length,
    pendingCount: items.filter((item) => item.status === "pending").length,
    missingCount: items.filter((item) => item.status === "missing").length,
    latestUpdated,
    items,
    blockingItems,
  };
}

export function formatReadinessBlockers(items: ResearchDataReadinessItem[], limit: number = 6) {
  const sample = items
    .slice(0, limit)
    .map((item) => `${item.symbol} ${item.timeframe} ${item.status}`)
    .join(", ");
  if (items.length <= limit) return sample || "no blocking rollups";
  return `${sample}, +${items.length - limit} more`;
}

export function buildReadinessErrorMessage(readiness: ResearchDataReadinessSummary) {
  return `Native Harvester rollups are ready for ${readiness.readyCount}/${readiness.total} requested symbol/timeframe pairs; ${readiness.blockingCount} still block the sweep: ${formatReadinessBlockers(readiness.blockingItems)}. Retry when Signal Harvester finishes rollups, or explicitly allow fallback rollups for a bounded smoke run.`;
}

export async function assertNativeResearchRollupsReady(
  marketData: MarketDataReader,
  options: {
    exchange?: string;
    symbols?: string[];
    timeframes?: string[];
    allowFallbackRollups?: boolean;
  } = {}
) {
  const exchange = options.exchange ?? "binance";
  const metrics = await marketData.getQualityMetrics({ exchange });
  const readiness = summarizeResearchDataReadiness(metrics, options);

  if (!options.allowFallbackRollups && !readiness.ready) {
    throw new Error(buildReadinessErrorMessage(readiness));
  }

  return readiness;
}

function classifyMetric(metric: MarketQualityMetric | undefined): ResearchDataReadinessStatus {
  if (!metric) return "missing";
  if (hasUsableNativeRollupCoverage(metric)) {
    return "ready";
  }
  if (metric.status === "running") return "running";
  return "pending";
}

function hasUsableNativeRollupCoverage(metric: MarketQualityMetric) {
  if (metric.totalCandles <= 0 || metric.earliest === null || metric.latest === null) {
    return false;
  }
  if (!hasAcceptableCompleteness(metric)) {
    return false;
  }

  if (metric.status === "complete") {
    return true;
  }

  if (!metric.nextStartTime || !metric.latestAvailableTime) {
    return false;
  }

  const nextStart = new Date(metric.nextStartTime).getTime();
  const latestAvailable = new Date(metric.latestAvailableTime).getTime();
  if (!Number.isFinite(nextStart) || !Number.isFinite(latestAvailable)) {
    return false;
  }

  try {
    return nextStart + timeframeToMs(metric.timeframe) > latestAvailable;
  } catch {
    return false;
  }
}

function hasAcceptableCompleteness(metric: MarketQualityMetric) {
  const completeness = Number(metric.completenessPct);
  if (!Number.isFinite(completeness)) return false;
  return completeness >= 98;
}

function metricKey(symbol: string, timeframe: string) {
  return `${symbol.toUpperCase()}::${timeframe}`;
}

function maxIsoDate(values: Array<string | null>) {
  const times = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter(Number.isFinite);
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}
