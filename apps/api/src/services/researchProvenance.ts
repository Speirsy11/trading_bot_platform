import type { backtests, researchResults } from "@tb/db";
import { TRPCError } from "@trpc/server";

import { parseJsonValue } from "../utils/serialization";

export type ResearchReplayConfig = {
  exchange?: string;
  endTime?: Date | number;
  strategy: string;
  strategyParams: Record<string, unknown>;
  symbol?: string;
  timeframe: string;
  startTime?: Date | number;
};

export function assertResearchReplayConfigMatches(
  row: typeof researchResults.$inferSelect,
  config: ResearchReplayConfig
) {
  const mismatches: string[] = [];
  const researchParams = parseJsonValue<Record<string, unknown>>(row.strategyParams, {});
  const researchSymbols = parseJsonValue<string[]>(row.symbols, []);
  const normalizedResearchSymbols = new Set(researchSymbols.map(normalizeSymbol));

  if (config.strategy !== row.strategy) {
    mismatches.push(`strategy ${config.strategy} does not match ${row.strategy}`);
  }

  if (config.timeframe !== row.timeframe) {
    mismatches.push(`timeframe ${config.timeframe} does not match ${row.timeframe}`);
  }

  if (!canonicalJsonEqual(config.strategyParams, researchParams)) {
    mismatches.push("strategy parameters do not match the research result");
  }

  if (
    config.symbol &&
    normalizedResearchSymbols.size > 0 &&
    !normalizedResearchSymbols.has(normalizeSymbol(config.symbol))
  ) {
    mismatches.push(`${config.symbol} was not part of the research result symbol set`);
  }

  if (mismatches.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Research provenance can only be attached to exact research replays: ${mismatches.join("; ")}`,
    });
  }
}

export function assertResearchReplayWindowMatches(
  row: typeof researchResults.$inferSelect,
  config: ResearchReplayConfig
) {
  if (!config.symbol || config.startTime == null || config.endTime == null) return;

  const coverage = parseJsonValue<Array<Record<string, unknown>>>(row.dataCoverage, []);
  const symbolCoverage = coverage.find(
    (entry) =>
      typeof entry["symbol"] === "string" &&
      normalizeSymbol(entry["symbol"]) === normalizeSymbol(config.symbol!)
  );

  if (!symbolCoverage) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Research provenance can only be attached to exact research replays: no source coverage found for ${config.symbol}`,
    });
  }

  const sourceStart = readTime(symbolCoverage["earliest"]);
  const sourceEnd = readTime(symbolCoverage["latest"]);
  const replayStart = readTime(config.startTime);
  const replayEnd = readTime(config.endTime);

  if (sourceStart === null || sourceEnd === null || replayStart === null || replayEnd === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Research provenance can only be attached to exact research replays: source coverage window is incomplete",
    });
  }

  if (sourceStart !== replayStart || sourceEnd !== replayEnd) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Research provenance can only be attached to exact research replays: replay time window does not match the source coverage window",
    });
  }
}

export function assertBacktestReplayConfigMatches(
  row: typeof backtests.$inferSelect,
  config: ResearchReplayConfig
) {
  const mismatches: string[] = [];
  const backtestParams = parseJsonValue<Record<string, unknown>>(row.strategyParams, {});

  if (config.exchange && normalizeExchange(config.exchange) !== normalizeExchange(row.exchange)) {
    mismatches.push(`exchange ${config.exchange} does not match ${row.exchange}`);
  }

  if (config.strategy !== row.strategy) {
    mismatches.push(`strategy ${config.strategy} does not match ${row.strategy}`);
  }

  if (config.timeframe !== row.timeframe) {
    mismatches.push(`timeframe ${config.timeframe} does not match ${row.timeframe}`);
  }

  if (config.symbol && normalizeSymbol(config.symbol) !== normalizeSymbol(row.symbol)) {
    mismatches.push(`symbol ${config.symbol} does not match ${row.symbol}`);
  }

  if (!canonicalJsonEqual(config.strategyParams, backtestParams)) {
    mismatches.push("strategy parameters do not match the backtest");
  }

  if (mismatches.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Backtest provenance can only be attached to exact backtest replays: ${mismatches.join("; ")}`,
    });
  }
}

export function canonicalJsonEqual(a: unknown, b: unknown) {
  return canonicalJson(a) === canonicalJson(b);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => [key, canonicalize(entryValue)])
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function normalizeExchange(exchange: string) {
  return exchange.trim().toLowerCase();
}

function readTime(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
