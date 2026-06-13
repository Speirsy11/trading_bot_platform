"use client";

import {
  Archive,
  BarChart3,
  Bot,
  CheckCircle2,
  Database,
  FlaskConical,
  GitBranch,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { HistoricalEvidenceNotice } from "@/components/research/HistoricalEvidenceNotice";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { toast } from "@/components/ui/Toaster";
import { formatDateShort, formatNumber, formatPercent, pnlColor } from "@/lib/format";
import {
  buildResearchBacktestHref,
  buildResearchBotHref,
  type ResearchCoverage,
} from "@/lib/researchHandoff";
import { buildResearchRouteContext } from "@/lib/researchRouteState";
import { trpc } from "@/lib/trpc";

type ResearchReadinessItem = {
  symbol: string;
  timeframe: string;
  status: "ready" | "running" | "pending" | "missing";
  sourceStatus?: string | null;
  totalCandles?: number;
  latest?: string | null;
  lastUpdated?: string | null;
};

type ResearchBenchmarkPayload = {
  totalReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
};

type ResearchMetricsPayload = {
  participatingSymbols?: number;
  positiveSymbols?: number;
  benchmark?: ResearchBenchmarkPayload;
  excessReturn?: number;
  drawdownAdvantage?: number;
};

type ResearchLeaderboardItem = {
  id: string;
  qualified: boolean;
  alphaQualified?: boolean;
  benchmarkBeat?: boolean;
  paperBotEligible?: boolean;
  benchmarkStatus?: string;
  outOfSampleReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  winRate: number;
  totalTrades: number;
  positiveSymbols: number;
  testMetrics: unknown;
  dataCoverage?: unknown;
  strategy: string;
  strategyName: string;
  strategyParams: Record<string, unknown>;
  timeframe: string;
  marketMode: string;
};

type ResearchEvidenceStatus =
  | "all"
  | "historically-profitable"
  | "alpha-qualified"
  | "benchmark-beater"
  | "unqualified";

const EVIDENCE_FILTER_OPTIONS: Array<{ value: ResearchEvidenceStatus; label: string }> = [
  { value: "all", label: "All evidence" },
  { value: "historically-profitable", label: "Historical profit" },
  { value: "alpha-qualified", label: "Alpha-qualified" },
  { value: "benchmark-beater", label: "Benchmark beat" },
  { value: "unqualified", label: "Unqualified" },
];

const STRATEGY_FILTER_OPTIONS = [
  { value: "all", label: "All strategies" },
  { value: "sma-crossover", label: "SMA crossover" },
  { value: "rsi-mean-reversion", label: "RSI mean reversion" },
  { value: "bollinger-long-bounce", label: "Bollinger bounce" },
  { value: "donchian-breakout", label: "Donchian breakout" },
  { value: "ema-atr-trend", label: "EMA/ATR trend" },
];

const TIMEFRAME_FILTER_OPTIONS = [
  { value: "all", label: "All timeframes" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
];

type ResearchSweepRequest = {
  name: string;
  exchange: string;
  symbols: string[];
  timeframes: Array<"15m" | "1h" | "4h">;
  strategyKeys: Array<
    | "sma-crossover"
    | "rsi-mean-reversion"
    | "bollinger-long-bounce"
    | "donchian-breakout"
    | "ema-atr-trend"
  >;
  allowFallbackRollups: boolean;
};

const SMOKE_SWEEP_CONFIG: ResearchSweepRequest = {
  name: "Current scorer 4h SMA smoke sweep",
  exchange: "binance",
  symbols: [
    "BTC/USDT",
    "ETH/USDT",
    "BNB/USDT",
    "ADA/USDT",
    "XRP/USDT",
    "TRX/USDT",
    "ZEC/USDT",
    "DOGE/USDT",
    "BCH/USDT",
    "SOL/USDT",
  ],
  timeframes: ["4h"],
  strategyKeys: ["sma-crossover"],
  allowFallbackRollups: true,
};

export default function ResearchPage() {
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const routeContext = useMemo(
    () =>
      buildResearchRouteContext({
        symbol: searchParams.get("symbol"),
        timeframe: searchParams.get("timeframe"),
      }),
    [searchParams]
  );
  const [evidenceStatus, setEvidenceStatus] = useState<ResearchEvidenceStatus>("all");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [timeframeFilter, setTimeframeFilter] = useState(routeContext.timeframeFilter);
  const leaderboardInput = useMemo(
    () => ({
      limit: 75,
      evidenceStatus,
      ...(strategyFilter === "all" ? {} : { strategyKeys: [strategyFilter] }),
      ...(timeframeFilter === "all" ? {} : { timeframes: [timeframeFilter] }),
    }),
    [evidenceStatus, strategyFilter, timeframeFilter]
  );
  const filtersActive =
    evidenceStatus !== "all" || strategyFilter !== "all" || timeframeFilter !== "all";
  const leaderboard = trpc.research.getLeaderboard.useQuery(leaderboardInput);
  const readiness = trpc.research.getDataReadiness.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const latestSweepId = leaderboard.data?.latestSweep?.id;
  const sweep = trpc.research.getSweep.useQuery(
    { sweepId: latestSweepId ?? "" },
    { enabled: Boolean(latestSweepId), refetchInterval: latestSweepId ? 5000 : false }
  );
  const runSweep = trpc.research.runSweep.useMutation({
    onSuccess: async (data) => {
      toast.success(`Research sweep queued with ${data.candidateCount} candidates`);
      await utils.research.getLeaderboard.invalidate();
    },
    onError: (error) => toast.error(`Failed to queue research sweep: ${error.message}`),
  });

  const items = (leaderboard.data?.items ?? []) as ResearchLeaderboardItem[];
  const leaderboardStats = leaderboard.data?.stats;
  const filteredCount = leaderboard.data?.filteredCount ?? items.length;
  const qualifiedCount =
    leaderboardStats?.qualified ?? items.filter((item) => item.qualified).length;
  const alphaQualifiedCount =
    leaderboardStats?.alphaQualified ?? items.filter((item) => item.alphaQualified).length;
  const benchmarkBeatCount =
    leaderboardStats?.benchmarkBeat ?? items.filter((item) => item.benchmarkBeat).length;
  const latest = sweep.data ?? leaderboard.data?.latestSweep;
  const archivedSweep = leaderboard.data?.latestArchivedSweep;
  const archivedSweepCount = leaderboard.data?.archivedSweepCount ?? 0;
  const currentEngineVersion =
    leaderboard.data?.currentEngineVersion ?? "research-lab-v1.3.4-time-aligned-portfolio";
  const latestResultCount = sweep.data?.resultCount ?? items.length;
  const latestProgress =
    sweep.data?.progress ??
    (latest?.status === "completed" ? 100 : latest?.status === "running" ? 1 : 0);
  const sweepActive = latest?.status === "running" || latest?.status === "pending";
  const fullSweepWaitingOnRollups = Boolean(readiness.data && !readiness.data.ready);
  const fullSweepDisabled =
    runSweep.isPending || sweepActive || readiness.isLoading || fullSweepWaitingOnRollups;
  const hasCurrentResults = (leaderboardStats?.total ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
            Research lab
          </p>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            Historical strategy evidence
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
            Spot long/flat sweeps across the Binance top 10 with fees, slippage, chronological
            splits, and out-of-sample qualification gates.
          </p>
          <div
            className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <GitBranch size={13} />
            {formatEngineVersion(currentEngineVersion)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {latest?.id && (
            <Link
              href={`/research/sweeps/${latest.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <GitBranch size={16} />
              Open sweep detail
            </Link>
          )}
          <button
            type="button"
            onClick={() => runSweep.mutate(SMOKE_SWEEP_CONFIG)}
            disabled={runSweep.isPending || sweepActive}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm disabled:opacity-60"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            <FlaskConical size={16} />
            {runSweep.isPending ? "Queueing..." : "Run smoke sweep"}
          </button>
          <button
            type="button"
            onClick={() => runSweep.mutate({})}
            disabled={fullSweepDisabled}
            title={
              fullSweepWaitingOnRollups
                ? "Native Harvester rollups are still building for the full top-10 sweep."
                : undefined
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
          >
            <Play size={16} />
            {runSweep.isPending
              ? "Queueing..."
              : readiness.isLoading
                ? "Checking rollups..."
                : fullSweepWaitingOnRollups
                  ? "Full sweep waiting"
                  : "Run full sweep"}
          </button>
        </div>
      </div>

      <HistoricalEvidenceNotice />

      {routeContext.hasChartContext && (
        <div
          className="flex flex-col gap-3 rounded-lg p-4 text-sm lg:flex-row lg:items-center lg:justify-between"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-start gap-3">
            <BarChart3 size={18} style={{ color: "var(--accent)", flex: "0 0 auto" }} />
            <div>
              <div style={{ color: "var(--text-primary)" }}>
                Chart context: {routeContext.symbol ?? "market"}{" "}
                {routeContext.timeframe ? `· ${routeContext.timeframe}` : ""}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Research rows remain top-10 equal-weight portfolio evidence.{" "}
                {routeContext.timeframe
                  ? `${routeContext.timeframe} candidates are preselected.`
                  : "No research timeframe was preselected."}
              </div>
            </div>
          </div>
          <Link
            href="/trading"
            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs"
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--border)",
            }}
          >
            Back to charts
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatusCard
          icon={FlaskConical}
          label="Latest sweep"
          value={latest?.status ?? "not run"}
          detail={
            latest?.createdAt
              ? `${latest.name}: ${latestResultCount} results · ${formatDateShort(latest.createdAt)}`
              : archivedSweep
                ? `${archivedSweepCount} archived sweep${archivedSweepCount === 1 ? "" : "s"} hidden`
                : "No research sweep has been persisted yet"
          }
        />
        <StatusCard
          icon={BarChart3}
          label="Leaderboard rows"
          value={String(leaderboardStats?.total ?? items.length)}
          detail={`${qualifiedCount} passed historical-profit gates`}
        />
        <StatusCard
          icon={ShieldCheck}
          label="Profit gate"
          value="OOS only"
          detail="Return > 0, pooled PF > 1.05, DD <= 30%, 30+ trades"
        />
        <StatusCard
          icon={GitBranch}
          label="Alpha gate"
          value={String(alphaQualifiedCount)}
          detail={`${benchmarkBeatCount} beat buy-and-hold; ${alphaQualifiedCount} passed all gates`}
        />
        <StatusCard
          icon={Database}
          label="Native rollups"
          value={
            readiness.data
              ? `${readiness.data.readyCount}/${readiness.data.total}`
              : readiness.isLoading
                ? "checking"
                : "unknown"
          }
          detail={
            readiness.data
              ? readiness.data.ready
                ? "15m, 1h, 4h ready for top-10 sweep"
                : `${readiness.data.blockingCount} blocking · ${readiness.data.runningCount} running`
              : "Harvester rollup status"
          }
        />
        <StatusCard
          icon={RefreshCw}
          label="Progress"
          value={`${Math.round(latestProgress)}%`}
          detail={latest?.error ? latest.error : "Signal Harvester is the candle source"}
        />
      </div>

      {readiness.data && !readiness.data.ready && (
        <div
          className="space-y-3 rounded-lg p-4 text-sm"
          style={{
            background: "rgba(251, 191, 36, 0.08)",
            color: "var(--text-secondary)",
            border: "1px solid rgba(251, 191, 36, 0.24)",
          }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Database size={18} style={{ color: "var(--accent)" }} />
              <div>
                <div style={{ color: "var(--text-primary)" }}>
                  Full research sweep is waiting for native Harvester rollups.
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Ready {readiness.data.readyCount}/{readiness.data.total}; waiting on{" "}
                  {summarizeBlockingRollups(readiness.data.blockingItems)}.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void readiness.refetch()}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <RefreshCw size={14} /> Check again
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {readiness.data.blockingItems.slice(0, 9).map((item) => (
              <div
                key={`${item.symbol}-${item.timeframe}`}
                className="grid grid-cols-[minmax(96px,1fr),48px,72px,minmax(72px,auto)] items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "rgba(0, 0, 0, 0.16)",
                  border: "1px solid rgba(251, 191, 36, 0.18)",
                }}
              >
                <span style={{ color: "var(--text-primary)" }}>{item.symbol}</span>
                <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {item.timeframe}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-center"
                  style={{
                    background:
                      item.status === "running" ? "var(--accent-dim)" : "rgba(251, 191, 36, 0.10)",
                    color: item.status === "running" ? "var(--accent)" : "var(--text-secondary)",
                    border: "1px solid rgba(251, 191, 36, 0.20)",
                  }}
                >
                  {item.status}
                </span>
                <span className="text-right tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {item.lastUpdated ? formatFreshnessAge(new Date(item.lastUpdated)) : "not run"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {archivedSweep && !latest && (
        <div
          className="flex flex-col gap-3 rounded-lg p-4 text-sm md:flex-row md:items-center"
          style={{
            background: "rgba(251, 191, 36, 0.08)",
            color: "var(--text-secondary)",
            border: "1px solid rgba(251, 191, 36, 0.24)",
          }}
        >
          <Archive size={18} style={{ color: "var(--accent)" }} />
          <div>
            <div style={{ color: "var(--text-primary)" }}>
              Archived research exists, but it was scored with{" "}
              {formatEngineVersion(archivedSweep.engineVersion)}.
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Run a new sweep to populate the current leaderboard with{" "}
              {formatEngineVersion(currentEngineVersion)}.
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel p-5">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
              Strategy leaderboard
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Ranked by qualified status, out-of-sample return, then drawdown.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void leaderboard.refetch()}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div
          className="mb-4 flex flex-col gap-3 rounded-lg p-3 xl:flex-row xl:items-center xl:justify-between"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Status"
              value={evidenceStatus}
              options={EVIDENCE_FILTER_OPTIONS}
              onChange={(value) => setEvidenceStatus(value as ResearchEvidenceStatus)}
            />
            <FilterSelect
              label="Strategy"
              value={strategyFilter}
              options={STRATEGY_FILTER_OPTIONS}
              onChange={setStrategyFilter}
            />
            <FilterSelect
              label="Timeframe"
              value={timeframeFilter}
              options={TIMEFRAME_FILTER_OPTIONS}
              onChange={(value) => setTimeframeFilter(value as typeof timeframeFilter)}
            />
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setEvidenceStatus("all");
                  setStrategyFilter("all");
                  setTimeframeFilter("all");
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs"
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <XCircle size={14} /> Clear
              </button>
            )}
          </div>
          <div className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            Showing {items.length.toLocaleString()} of {filteredCount.toLocaleString()} matching
            rows
          </div>
        </div>

        {leaderboard.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-lg"
                style={{ background: "var(--bg-input)" }}
              />
            ))}
          </div>
        ) : leaderboard.isError ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm" style={{ color: "var(--loss)" }}>
              Failed to load research results
            </p>
            <button
              type="button"
              onClick={() => void leaderboard.refetch()}
              className="rounded-lg px-3 py-1.5 text-xs"
              style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FlaskConical size={48} style={{ color: "var(--text-muted)", opacity: 0.45 }} />
            <p className="mt-4 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {filtersActive && hasCurrentResults
                ? "No research rows match these filters"
                : "No current-version research results yet"}
            </p>
            <p className="mt-1 max-w-md text-xs" style={{ color: "var(--text-muted)" }}>
              {filtersActive && hasCurrentResults
                ? "Adjust the leaderboard filters to inspect the rest of the current sweep."
                : `Run a sweep to evaluate transparent technical strategies across full available Binance spot history with ${formatEngineVersion(
                    currentEngineVersion
                  )}.`}
            </p>
          </div>
        ) : (
          <>
            {qualifiedCount === 0 && (
              <div
                className="mb-4 rounded-lg p-3 text-sm"
                style={{
                  background: "rgba(251, 191, 36, 0.08)",
                  color: "var(--text-secondary)",
                  border: "1px solid rgba(251, 191, 36, 0.24)",
                }}
              >
                No strategy currently passes every historical-profit gate. The table still ranks the
                best unqualified candidates for further research.
              </div>
            )}
            {qualifiedCount > 0 && alphaQualifiedCount === 0 && (
              <div
                className="mb-4 rounded-lg p-3 text-sm"
                style={{
                  background: "rgba(251, 191, 36, 0.08)",
                  color: "var(--text-secondary)",
                  border: "1px solid rgba(251, 191, 36, 0.24)",
                }}
              >
                No historically profitable row currently clears benchmark-alpha. Qualified rows can
                still be paper-tested; benchmark lag stays visible in the evidence.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-sm">
                <thead>
                  <tr
                    style={{
                      color: "var(--text-muted)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <th className="py-2 pr-4 text-left text-xs font-normal">Status</th>
                    <th className="py-2 pr-4 text-left text-xs font-normal">Act</th>
                    <th className="py-2 pr-4 text-left text-xs font-normal">Fresh</th>
                    <th className="py-2 pr-4 text-left text-xs font-normal">Strategy</th>
                    <th className="py-2 pr-4 text-left text-xs font-normal">Params</th>
                    <th className="py-2 pr-4 text-left text-xs font-normal">TF</th>
                    <MetricHeader label="OOS" term="Out-of-sample return" />
                    <MetricHeader label="Bench" term="Benchmark return" />
                    <MetricHeader label="Excess" term="Excess return" />
                    <MetricHeader label="DD" term="Max drawdown" />
                    <MetricHeader label="Sharpe" term="Sharpe ratio" />
                    <MetricHeader label="PF" term="Profit factor" />
                    <MetricHeader label="Win" term="Win rate" />
                    <th className="py-2 pr-4 text-right text-xs font-normal">Trades</th>
                    <MetricHeader label="+ Syms" term="Positive symbols" />
                    <MetricHeader label="Part" term="Participating symbols" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const dataFreshness = summarizeDataFreshness(
                      item.dataCoverage as ResearchCoverage[]
                    );
                    const testMetrics = item.testMetrics as ResearchMetricsPayload;
                    const benchmarkReturn = getBenchmarkReturn(testMetrics);
                    const excessReturn = getMetricNumber(testMetrics.excessReturn);
                    const status = getResultStatus(item);
                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                        <td className="py-3 pr-4">
                          <span
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs"
                            style={status.style}
                          >
                            {status.icon}
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {item.qualified ? (
                            <div className="inline-flex items-center gap-1">
                              <ActionLink
                                href={buildResearchBacktestHref(item)}
                                label="Open manual backtest"
                                icon={<FlaskConical size={14} />}
                              />
                              <ActionLink
                                href={buildResearchBotHref(item)}
                                label="Create paper bot draft"
                                icon={<Bot size={14} />}
                                accent
                              />
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              -
                            </span>
                          )}
                        </td>
                        <td
                          className="py-3 pr-4 text-xs"
                          style={{
                            color: dataFreshness.latest
                              ? "var(--text-secondary)"
                              : "var(--text-muted)",
                          }}
                          title={dataFreshness.title}
                        >
                          <div>
                            {dataFreshness.latest
                              ? formatFreshnessAge(dataFreshness.latest)
                              : "n/a"}
                          </div>
                          <div style={{ color: "var(--text-muted)" }}>
                            {dataFreshness.symbolCount} syms
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <Link
                            href={`/research/${item.id}`}
                            style={{ color: "var(--text-primary)" }}
                          >
                            {item.strategyName}
                          </Link>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {item.marketMode}
                          </div>
                        </td>
                        <td
                          className="max-w-[160px] truncate py-3 pr-4 text-xs"
                          style={{ color: "var(--text-muted)" }}
                          title={formatParams(item.strategyParams)}
                        >
                          {formatParams(item.strategyParams)}
                        </td>
                        <td className="py-3 pr-4" style={{ color: "var(--text-secondary)" }}>
                          {item.timeframe}
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{ color: pnlColor(item.outOfSampleReturn) }}
                        >
                          {formatPercent(item.outOfSampleReturn)}
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{
                            color:
                              benchmarkReturn === null
                                ? "var(--text-muted)"
                                : pnlColor(benchmarkReturn),
                          }}
                        >
                          {benchmarkReturn === null ? "n/a" : formatPercent(benchmarkReturn)}
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{
                            color:
                              excessReturn === null ? "var(--text-muted)" : pnlColor(excessReturn),
                          }}
                        >
                          {excessReturn === null ? "n/a" : formatPercent(excessReturn)}
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{ color: "var(--loss)" }}
                        >
                          {formatPercent(-item.maxDrawdown)}
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {formatNumber(item.sharpeRatio, 2)}
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {formatNumber(item.profitFactor, 2)}
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {formatPercent(item.winRate, 1)}
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {Math.round(item.totalTrades).toLocaleString()}
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {Math.round(item.positiveSymbols)}/10
                        </td>
                        <td
                          className="py-3 pr-4 text-right tabular-nums"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {getParticipatingSymbols(testMetrics)}/10
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-lg px-3 text-xs">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-xs outline-none"
        style={{ color: "var(--text-primary)" }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="glass-panel p-4">
      <Icon size={20} style={{ color: "var(--accent)" }} />
      <div
        className="mt-3 text-xs uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div className="mt-1 text-xl" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {detail}
      </div>
    </div>
  );
}

function MetricHeader({ label, term }: { label: string; term: string }) {
  return (
    <th className="py-2 pr-4 text-right text-xs font-normal">
      {label}
      <MetricTooltip term={term} definition={metricDefinition(term)} />
    </th>
  );
}

function ActionLink({
  href,
  label,
  icon,
  accent = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
      style={{
        background: accent ? "var(--accent)" : "var(--bg-input)",
        color: accent ? "var(--primary-foreground)" : "var(--text-primary)",
        border: accent ? "1px solid transparent" : "1px solid var(--border)",
      }}
    >
      {icon}
    </Link>
  );
}

function getResultStatus(item: ResearchLeaderboardItem) {
  if (item.alphaQualified) {
    return {
      label: "Alpha",
      icon: <CheckCircle2 size={13} />,
      style: {
        background: "var(--accent-dim)",
        color: "var(--accent)",
      },
    };
  }

  if (item.qualified) {
    return {
      label: "Historical profit",
      icon: <CheckCircle2 size={13} />,
      style: {
        background: "rgba(251, 191, 36, 0.08)",
        color: "var(--accent)",
      },
    };
  }

  if (item.benchmarkBeat) {
    return {
      label: "Bench beat",
      icon: <XCircle size={13} />,
      style: {
        background: "rgba(251, 191, 36, 0.08)",
        color: "var(--accent)",
      },
    };
  }

  return {
    label: "Research",
    icon: <XCircle size={13} />,
    style: {
      background: "rgba(248,113,113,0.1)",
      color: "var(--loss)",
    },
  };
}

function metricDefinition(term: string) {
  if (term === "Out-of-sample return") {
    return "Net return on the final chronological test split only.";
  }
  if (term === "Benchmark return") {
    return "Equal-weight buy-and-hold return across the same symbols and test window, using the same fee and slippage assumptions.";
  }
  if (term === "Excess return") {
    return "Strategy out-of-sample return minus equal-weight buy-and-hold benchmark return.";
  }
  if (term === "Max drawdown") {
    return "Largest peak-to-trough equity decline in the out-of-sample split.";
  }
  if (term === "Sharpe ratio") {
    return "Risk-adjusted return based on the equal-weight portfolio equity curve.";
  }
  if (term === "Profit factor") {
    return "Gross profit divided by gross loss across pooled closed trades.";
  }
  if (term === "Win rate") {
    return "Winning closed trades divided by all pooled closed trades.";
  }
  if (term === "Positive symbols") {
    return "Number of symbols with positive out-of-sample return and at least one trade.";
  }
  return "Number of symbols with enough out-of-sample trades to count toward the qualification breadth gate.";
}

function formatParams(params: Record<string, unknown>) {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
}

function summarizeBlockingRollups(items: ResearchReadinessItem[] = []) {
  const sample = items
    .slice(0, 6)
    .map((item) => `${item.symbol} ${item.timeframe} ${item.status}`)
    .join(", ");
  if (items.length <= 6) return sample || "no missing rollups";
  return `${sample}, +${items.length - 6} more`;
}

function formatEngineVersion(version?: string | null) {
  if (!version || version === "legacy") return "legacy scorer";
  return version
    .replace(/^research-lab-/, "")
    .replace("-time-aligned-portfolio", " time-aligned portfolio")
    .replace("-donchian-optional-stop", " optional Donchian stop")
    .replace("-benchmark-reuse", " benchmarked")
    .replace("-equal-weight-benchmark", " benchmarked")
    .replace("-curve-consistent-portfolio-metrics", " portfolio curve")
    .replace("-pooled-portfolio-metrics", " pooled portfolio");
}

function getMetricNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBenchmarkReturn(metrics: ResearchMetricsPayload) {
  return getMetricNumber(metrics.benchmark?.totalReturn);
}

function getParticipatingSymbols(metrics: unknown) {
  const payload = metrics as ResearchMetricsPayload | null;
  const value = payload?.participatingSymbols;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

function summarizeDataFreshness(coverage: ResearchCoverage[] = []) {
  const latestDates = coverage
    .map((row) => (row.latest ? new Date(row.latest) : null))
    .filter(isValidDate);
  const earliestDates = coverage
    .map((row) => (row.earliest ? new Date(row.earliest) : null))
    .filter(isValidDate);
  const laggingLatest =
    latestDates.length > 0
      ? new Date(Math.min(...latestDates.map((date) => date.getTime())))
      : null;
  const earliest =
    earliestDates.length > 0
      ? new Date(Math.min(...earliestDates.map((date) => date.getTime())))
      : null;

  return {
    latest: laggingLatest,
    symbolCount: coverage.length,
    title: laggingLatest
      ? `Lagging latest candle: ${formatDateShort(laggingLatest)}${
          earliest ? ` · Earliest coverage: ${formatDateShort(earliest)}` : ""
        }`
      : "No source coverage metadata",
  };
}

function isValidDate(date: Date | null): date is Date {
  return date !== null && Number.isFinite(date.getTime());
}

function formatFreshnessAge(date: Date) {
  const ageMs = Math.max(Date.now() - date.getTime(), 0);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
