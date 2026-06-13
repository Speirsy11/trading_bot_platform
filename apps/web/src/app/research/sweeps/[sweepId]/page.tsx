"use client";

import {
  ArrowLeft,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Database,
  FlaskConical,
  GitBranch,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { use, type ReactNode } from "react";

import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { HistoricalEvidenceNotice } from "@/components/research/HistoricalEvidenceNotice";
import { formatDateShort, formatNumber, formatPercent, pnlColor } from "@/lib/format";
import { buildResearchBacktestHref, buildResearchBotHref } from "@/lib/researchHandoff";
import { trpc } from "@/lib/trpc";

type SweepConfig = {
  exchange?: string;
  symbols?: string[];
  timeframes?: string[];
  strategyKeys?: string[];
  allowFallbackRollups?: boolean;
  engineVersion?: string;
};

type SweepRecord = {
  id: string;
  name: string;
  status: string;
  config?: unknown;
  symbols?: string[];
  timeframes?: string[];
  strategyKeys?: string[];
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  engineVersion?: string;
  progress?: number;
  resultCount?: number;
  error?: string | null;
};

type LeaderboardItem = {
  id: string;
  strategyName: string;
  strategy: string;
  strategyParams: Record<string, unknown>;
  timeframe: string;
  qualified: boolean;
  alphaQualified?: boolean;
  benchmarkBeat?: boolean;
  outOfSampleReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  totalTrades: number;
  positiveSymbols: number;
  dataCoverage?: unknown;
  testMetrics?: {
    participatingSymbols?: number;
    benchmark?: { totalReturn?: number };
    excessReturn?: number;
  };
};

type ResultDetail = LeaderboardItem & {
  trainMetrics?: AggregateMetrics;
  validationMetrics?: AggregateMetrics;
  perSymbolResults?: PerSymbolResult[];
  portfolioEquityCurve?: Array<{ time: number; equity: number }>;
  drawdownCurve?: Array<{ time: number; drawdown: number }>;
};

type AggregateMetrics = {
  totalReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  profitFactor?: number;
  winRate?: number;
  totalTrades?: number;
  positiveSymbols?: number;
  participatingSymbols?: number;
  benchmark?: { totalReturn?: number };
  excessReturn?: number;
};

type PerSymbolResult = {
  symbol: string;
  coverage?: { earliest: string | null; latest: string | null; totalCandles: number };
  splits?: {
    train?: { metrics?: AggregateMetrics };
    validation?: { metrics?: AggregateMetrics };
    test?: { metrics?: AggregateMetrics; benchmark?: { totalReturn?: number } };
  };
};

export default function ResearchSweepPage({ params }: { params: Promise<{ sweepId: string }> }) {
  const { sweepId } = use(params);
  const detailQuery = trpc.research.getSweepDetail.useQuery(
    { sweepId, limit: 100 },
    { refetchInterval: 5000 }
  );
  const detail = detailQuery.data;
  const items = (detail?.items ?? []) as LeaderboardItem[];
  const stats = detail?.stats;
  const result = detail?.topResult as ResultDetail | null | undefined;
  const topCandidate = result ?? items[0];
  const sweep = detail?.sweep as SweepRecord | undefined;
  const config = parseSweepConfig(sweep?.config);
  const equityCurve =
    result?.portfolioEquityCurve?.map((point) => ({ time: point.time, value: point.equity })) ?? [];
  const drawdownCurve = result?.drawdownCurve ?? [];
  const benchmarkCurve =
    result?.testMetrics?.benchmark && "equityCurve" in result.testMetrics.benchmark
      ? (
          (
            result.testMetrics.benchmark as {
              equityCurve?: Array<{ time: number; equity: number }>;
            }
          ).equityCurve ?? []
        ).map((point) => ({ time: point.time, value: point.equity }))
      : [];
  const progress = normalizeProgress(sweep?.progress, sweep?.status);

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div
          className="h-8 w-64 animate-pulse rounded-lg"
          style={{ background: "var(--bg-input)" }}
        />
        <div className="glass-panel h-80 animate-pulse" />
      </div>
    );
  }

  if (!sweep) {
    return (
      <div
        className="flex flex-col items-center gap-4 py-20"
        style={{ color: "var(--text-muted)" }}
      >
        <p>Research sweep not found</p>
        <Link href="/research" className="text-sm" style={{ color: "var(--accent)" }}>
          Back to research
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/research"
            aria-label="Back to research"
            className="rounded-lg p-2"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
              Sweep detail
            </p>
            <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
              {sweep.name}
            </h1>
            <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
              Full-run evidence across strategy families, rollup intervals, and the Binance top-10
              spot universe.
            </p>
          </div>
        </div>
        <div
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: sweep.status === "completed" ? "var(--accent-dim)" : "var(--bg-input)",
            color: sweep.status === "completed" ? "var(--accent)" : "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          {sweep.status} · {Math.round(progress)}%
        </div>
      </div>

      <HistoricalEvidenceNotice />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatusCard
          icon={FlaskConical}
          label="Candidates"
          value={String(stats?.total ?? sweep.resultCount ?? items.length)}
          detail={`${stats?.qualified ?? 0} historical-profit rows`}
        />
        <StatusCard
          icon={ShieldCheck}
          label="Alpha rows"
          value={String(stats?.alphaQualified ?? 0)}
          detail={`${stats?.benchmarkBeat ?? 0} beat buy-and-hold`}
        />
        <StatusCard
          icon={Database}
          label="Universe"
          value={`${(config.symbols ?? sweep.symbols ?? []).length || 0} symbols`}
          detail={(config.symbols ?? sweep.symbols ?? []).slice(0, 4).join(", ") || "not recorded"}
        />
        <StatusCard
          icon={BarChart3}
          label="Timeframes"
          value={(config.timeframes ?? sweep.timeframes ?? []).join(", ") || "n/a"}
          detail="Native Harvester candles"
        />
        <StatusCard
          icon={GitBranch}
          label="Engine"
          value={formatEngineVersion(sweep.engineVersion ?? config.engineVersion)}
          detail={
            config.allowFallbackRollups ? "fallback rollups allowed" : "native rollups required"
          }
        />
        <StatusCard
          icon={Clock}
          label="Completed"
          value={sweep.completedAt ? formatDateShort(sweep.completedAt) : "pending"}
          detail={sweep.createdAt ? `created ${formatDateShort(sweep.createdAt)}` : "no timestamp"}
        />
      </div>

      {sweep.error && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{
            background: "rgba(248, 113, 113, 0.08)",
            color: "var(--loss)",
            border: "1px solid rgba(248, 113, 113, 0.24)",
          }}
        >
          {sweep.error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <div className="glass-panel p-5">
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
                  Top candidate portfolio equity
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {topCandidate
                    ? `${topCandidate.strategyName} · ${topCandidate.timeframe} · ${formatParams(
                        topCandidate.strategyParams
                      )}`
                    : "No candidate results have been persisted for this sweep."}
                </p>
              </div>
              {topCandidate && (
                <Link
                  href={`/research/${topCandidate.id}`}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Open result
                </Link>
              )}
            </div>
            <PerformanceChart
              data={equityCurve}
              comparisonData={benchmarkCurve}
              seriesName="Top strategy"
              comparisonName="Buy and hold"
              height={320}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="glass-panel p-5">
              <h2 className="mb-4 text-lg" style={{ color: "var(--text-primary)" }}>
                Top candidate drawdown
              </h2>
              <DrawdownChart data={drawdownCurve} height={260} />
            </div>
            <div className="glass-panel p-5">
              <h2 className="mb-4 text-lg" style={{ color: "var(--text-primary)" }}>
                Split comparison
              </h2>
              <div className="space-y-2">
                <SplitRow label="Train" metrics={result?.trainMetrics} />
                <SplitRow label="Validation" metrics={result?.validationMetrics} />
                <SplitRow label="Out of sample" metrics={result?.testMetrics} highlight />
              </div>
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="mb-4">
              <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
                Per-symbol evidence for top candidate
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Test split performance across the top-10 portfolio constituents.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr
                    style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}
                  >
                    <th className="py-2 pr-3 text-left text-xs font-normal">Symbol</th>
                    <th className="py-2 pr-3 text-left text-xs font-normal">Coverage</th>
                    <th className="py-2 pr-3 text-right text-xs font-normal">OOS</th>
                    <th className="py-2 pr-3 text-right text-xs font-normal">Bench</th>
                    <th className="py-2 pr-3 text-right text-xs font-normal">Excess</th>
                    <th className="py-2 pr-3 text-right text-xs font-normal">Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {(result?.perSymbolResults ?? []).map((row) => {
                    const test = row.splits?.test?.metrics;
                    const benchmark = readNumber(row.splits?.test?.benchmark?.totalReturn);
                    const totalReturn = readNumber(test?.totalReturn);
                    const excess =
                      totalReturn === null || benchmark === null ? null : totalReturn - benchmark;
                    return (
                      <tr key={row.symbol} style={{ borderBottom: "1px solid var(--grid)" }}>
                        <td className="py-3 pr-3" style={{ color: "var(--text-primary)" }}>
                          {row.symbol}
                        </td>
                        <td className="py-3 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                          {row.coverage?.earliest ? formatDateShort(row.coverage.earliest) : "n/a"}{" "}
                          to {row.coverage?.latest ? formatDateShort(row.coverage.latest) : "n/a"}
                        </td>
                        <td
                          className="py-3 pr-3 text-right tabular-nums"
                          style={{ color: pnlColor(totalReturn ?? 0) }}
                        >
                          {totalReturn === null ? "n/a" : formatPercent(totalReturn)}
                        </td>
                        <td
                          className="py-3 pr-3 text-right tabular-nums"
                          style={{
                            color: benchmark === null ? "var(--text-muted)" : pnlColor(benchmark),
                          }}
                        >
                          {benchmark === null ? "n/a" : formatPercent(benchmark)}
                        </td>
                        <td
                          className="py-3 pr-3 text-right tabular-nums"
                          style={{
                            color: excess === null ? "var(--text-muted)" : pnlColor(excess),
                          }}
                        >
                          {excess === null ? "n/a" : formatPercent(excess)}
                        </td>
                        <td
                          className="py-3 pr-3 text-right tabular-nums"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {Math.round(readNumber(test?.totalTrades) ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-5">
            <h2 className="mb-4 text-lg" style={{ color: "var(--text-primary)" }}>
              Qualification distribution
            </h2>
            <div className="space-y-3">
              <DistributionBar
                label="Historical profit"
                count={stats?.qualified ?? 0}
                total={stats?.total ?? 0}
                color="var(--accent)"
              />
              <DistributionBar
                label="Benchmark beat"
                count={stats?.benchmarkBeat ?? 0}
                total={stats?.total ?? 0}
                color="var(--profit)"
              />
              <DistributionBar
                label="Alpha-qualified"
                count={stats?.alphaQualified ?? 0}
                total={stats?.total ?? 0}
                color="var(--profit)"
              />
            </div>
          </div>

          <div className="glass-panel p-5">
            <h2 className="mb-3 text-lg" style={{ color: "var(--text-primary)" }}>
              Exact sweep config
            </h2>
            <pre
              className="max-h-[420px] overflow-auto rounded-lg p-4 text-xs"
              style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}
            >
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="mb-4">
          <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
            Top sweep results
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Ranked by qualification, out-of-sample return, and drawdown.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th className="py-2 pr-4 text-left text-xs font-normal">Status</th>
                <th className="py-2 pr-4 text-left text-xs font-normal">Act</th>
                <th className="py-2 pr-4 text-left text-xs font-normal">Strategy</th>
                <th className="py-2 pr-4 text-left text-xs font-normal">Params</th>
                <th className="py-2 pr-4 text-left text-xs font-normal">TF</th>
                <th className="py-2 pr-4 text-right text-xs font-normal">OOS</th>
                <th className="py-2 pr-4 text-right text-xs font-normal">Bench</th>
                <th className="py-2 pr-4 text-right text-xs font-normal">Excess</th>
                <th className="py-2 pr-4 text-right text-xs font-normal">DD</th>
                <th className="py-2 pr-4 text-right text-xs font-normal">PF</th>
                <th className="py-2 pr-4 text-right text-xs font-normal">Trades</th>
                <th className="py-2 pr-4 text-right text-xs font-normal">Breadth</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = resultStatus(item);
                const benchmark = readNumber(item.testMetrics?.benchmark?.totalReturn);
                const excess = readNumber(item.testMetrics?.excessReturn);
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
                          <SweepActionLink
                            href={buildResearchBacktestHref(item)}
                            label="Open manual backtest"
                            icon={<FlaskConical size={14} />}
                          />
                          <SweepActionLink
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
                    <td className="py-3 pr-4">
                      <Link href={`/research/${item.id}`} style={{ color: "var(--text-primary)" }}>
                        {item.strategyName}
                      </Link>
                    </td>
                    <td
                      className="max-w-[180px] truncate py-3 pr-4 text-xs"
                      title={formatParams(item.strategyParams)}
                      style={{ color: "var(--text-muted)" }}
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
                        color: benchmark === null ? "var(--text-muted)" : pnlColor(benchmark),
                      }}
                    >
                      {benchmark === null ? "n/a" : formatPercent(benchmark)}
                    </td>
                    <td
                      className="py-3 pr-4 text-right tabular-nums"
                      style={{ color: excess === null ? "var(--text-muted)" : pnlColor(excess) }}
                    >
                      {excess === null ? "n/a" : formatPercent(excess)}
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
                      {formatNumber(item.profitFactor, 2)}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SweepActionLink({
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
      className="inline-flex h-8 w-8 items-center justify-center rounded-md"
      style={{
        background: accent ? "var(--accent)" : "var(--bg-input)",
        color: accent ? "var(--primary-foreground)" : "var(--text-secondary)",
        border: accent ? "1px solid var(--accent)" : "1px solid var(--border)",
      }}
    >
      {icon}
    </Link>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FlaskConical;
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

function SplitRow({
  label,
  metrics,
  highlight = false,
}: {
  label: string;
  metrics?: AggregateMetrics;
  highlight?: boolean;
}) {
  const totalReturn = readNumber(metrics?.totalReturn);
  const benchmark = readNumber(metrics?.benchmark?.totalReturn);
  const excess = readNumber(metrics?.excessReturn);
  return (
    <div
      className="grid grid-cols-[1fr_repeat(4,minmax(68px,auto))] gap-2 rounded-lg px-3 py-2 text-xs"
      style={{
        background: highlight ? "rgba(200, 165, 90, 0.10)" : "var(--bg-input)",
        border: highlight ? "1px solid rgba(200, 165, 90, 0.24)" : "1px solid var(--border)",
      }}
    >
      <span style={{ color: "var(--text-primary)" }}>{label}</span>
      <span
        className="text-right tabular-nums"
        style={{ color: totalReturn === null ? "var(--text-muted)" : pnlColor(totalReturn) }}
      >
        {totalReturn === null ? "n/a" : formatPercent(totalReturn)}
      </span>
      <span
        className="text-right tabular-nums"
        style={{ color: benchmark === null ? "var(--text-muted)" : pnlColor(benchmark) }}
      >
        {benchmark === null ? "bench n/a" : formatPercent(benchmark)}
      </span>
      <span
        className="text-right tabular-nums"
        style={{ color: excess === null ? "var(--text-muted)" : pnlColor(excess) }}
      >
        {excess === null ? "excess n/a" : formatPercent(excess)}
      </span>
      <span className="text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {Math.round(readNumber(metrics?.totalTrades) ?? 0).toLocaleString()} trades
      </span>
    </div>
  );
}

function DistributionBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const width = total > 0 ? Math.min((count / total) * 100, 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
          {count}/{total}
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "var(--bg-input)" }}>
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

function parseSweepConfig(value: unknown): SweepConfig {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as SweepConfig) : {};
}

function resultStatus(item: LeaderboardItem) {
  if (item.alphaQualified) {
    return {
      label: "Alpha",
      icon: <CheckCircle2 size={13} />,
      style: { background: "var(--accent-dim)", color: "var(--accent)" },
    };
  }
  if (item.qualified) {
    return {
      label: "Historical profit",
      icon: <CheckCircle2 size={13} />,
      style: { background: "rgba(251, 191, 36, 0.08)", color: "var(--accent)" },
    };
  }
  if (item.benchmarkBeat) {
    return {
      label: "Bench beat",
      icon: <XCircle size={13} />,
      style: { background: "rgba(251, 191, 36, 0.08)", color: "var(--accent)" },
    };
  }
  return {
    label: "Research",
    icon: <XCircle size={13} />,
    style: { background: "rgba(248,113,113,0.1)", color: "var(--loss)" },
  };
}

function normalizeProgress(progress: number | undefined, status: string | undefined) {
  if (typeof progress === "number" && Number.isFinite(progress)) {
    return progress <= 1 ? progress * 100 : progress;
  }
  return status === "completed" ? 100 : status === "running" ? 1 : 0;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatParams(params: Record<string, unknown>) {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
}

function formatEngineVersion(version?: string | null) {
  if (!version || version === "legacy") return "legacy";
  return version
    .replace(/^research-lab-/, "")
    .replace("-time-aligned-portfolio", " time-aligned")
    .replace("-benchmark-reuse", " benchmarked");
}
