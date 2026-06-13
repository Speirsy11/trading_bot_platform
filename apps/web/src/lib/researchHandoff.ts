export type ResearchCoverage = {
  symbol?: string;
  earliest: string | null;
  latest: string | null;
  totalCandles?: number;
  gapCount?: number;
};

export type ResearchHandoffSource = {
  id: string;
  strategy: string;
  strategyName: string;
  strategyParams: Record<string, unknown>;
  timeframe: string;
  dataCoverage?: unknown;
  executionAssumptions?: unknown;
};

export const RESEARCH_HANDOFF_DEFAULTS = {
  exchange: "binance",
  preferredSymbol: "BTC/USDT",
  marketMode: "spot",
  initialBalance: 10_000,
  makerFee: 0.001,
  takerFee: 0.001,
  slippagePct: 0.0005,
  paperRiskConfig: {
    maxPositionSizePercent: 10,
    maxDrawdownPercent: 20,
    riskPerTradePercent: 2,
    maxConcurrentPositions: 5,
    maxDailyLossPercent: 5,
    trailingStopEnabled: false,
    trailingStopPercent: 5,
  },
} as const;

export type ResearchExecutionAssumptions = {
  marketMode: string;
  initialBalance: number;
  fees: {
    maker: number;
    taker: number;
  };
  slippage: {
    enabled: boolean;
    percentage: number;
  };
};

export function buildResearchBacktestHref(result: ResearchHandoffSource) {
  const coverage = selectResearchReplayCoverage(result.dataCoverage);
  const execution = resolveResearchExecutionAssumptions(result.executionAssumptions);
  const params = new URLSearchParams({
    strategy: result.strategy,
    strategyParams: JSON.stringify(result.strategyParams),
    exchange: RESEARCH_HANDOFF_DEFAULTS.exchange,
    symbol: coverage?.symbol ?? RESEARCH_HANDOFF_DEFAULTS.preferredSymbol,
    timeframe: result.timeframe,
    name: `${result.strategyName} research replay`,
    sourceResearch: result.id,
    initialBalance: String(execution.initialBalance),
    makerFee: String(execution.fees.maker),
    takerFee: String(execution.fees.taker),
    slippagePct: String(execution.slippage.enabled ? execution.slippage.percentage : 0),
  });

  if (coverage?.earliest) {
    params.set("startTime", String(new Date(coverage.earliest).getTime()));
  }
  if (coverage?.latest) {
    params.set("endTime", String(new Date(coverage.latest).getTime()));
  }

  return `/backtest?${params.toString()}`;
}

export function buildResearchBotHref(result: ResearchHandoffSource) {
  const coverage = selectResearchReplayCoverage(result.dataCoverage);
  const execution = resolveResearchExecutionAssumptions(result.executionAssumptions);
  const params = new URLSearchParams({
    mode: "paper",
    strategy: result.strategy,
    strategyParams: JSON.stringify(result.strategyParams),
    exchange: RESEARCH_HANDOFF_DEFAULTS.exchange,
    symbol: coverage?.symbol ?? RESEARCH_HANDOFF_DEFAULTS.preferredSymbol,
    timeframe: result.timeframe,
    name: `${result.strategyName} research paper run`,
    sourceResearch: result.id,
    balance: String(execution.initialBalance),
    riskConfig: JSON.stringify(RESEARCH_HANDOFF_DEFAULTS.paperRiskConfig),
  });

  return `/bots/new?${params.toString()}`;
}

export function selectResearchReplayCoverage(
  dataCoverage: unknown,
  preferredSymbol = RESEARCH_HANDOFF_DEFAULTS.preferredSymbol
): ResearchCoverage | null {
  const coverage = parseResearchCoverage(dataCoverage);
  return coverage.find((row) => row.symbol === preferredSymbol) ?? coverage[0] ?? null;
}

export function parseResearchCoverage(dataCoverage: unknown): ResearchCoverage[] {
  if (!Array.isArray(dataCoverage)) return [];
  return dataCoverage.filter(isResearchCoverage);
}

export function resolveResearchExecutionAssumptions(value: unknown): ResearchExecutionAssumptions {
  const record = isRecord(value) ? value : {};
  const fees = isRecord(record["fees"]) ? record["fees"] : {};
  const slippage = isRecord(record["slippage"]) ? record["slippage"] : {};

  return {
    marketMode: readString(record["marketMode"], RESEARCH_HANDOFF_DEFAULTS.marketMode),
    initialBalance: readNumber(record["initialBalance"], RESEARCH_HANDOFF_DEFAULTS.initialBalance),
    fees: {
      maker: readNumber(fees["maker"], RESEARCH_HANDOFF_DEFAULTS.makerFee),
      taker: readNumber(fees["taker"], RESEARCH_HANDOFF_DEFAULTS.takerFee),
    },
    slippage: {
      enabled:
        typeof slippage["enabled"] === "boolean"
          ? slippage["enabled"]
          : RESEARCH_HANDOFF_DEFAULTS.slippagePct > 0,
      percentage: readNumber(slippage["percentage"], RESEARCH_HANDOFF_DEFAULTS.slippagePct),
    },
  };
}

function isResearchCoverage(value: unknown): value is ResearchCoverage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const symbol = record["symbol"];
  return symbol === undefined || typeof symbol === "string";
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
