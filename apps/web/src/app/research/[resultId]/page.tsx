"use client";

import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Database,
  FlaskConical,
  GitBranch,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { HistoricalEvidenceNotice } from "@/components/research/HistoricalEvidenceNotice";
import {
  formatCurrency,
  formatDateShort,
  formatNumber,
  formatPercent,
  pnlColor,
} from "@/lib/format";
import { summarizeResearchEvidenceAudit } from "@/lib/researchEvidenceAudit";
import {
  buildResearchBacktestHref,
  buildResearchBotHref,
  resolveResearchExecutionAssumptions,
} from "@/lib/researchHandoff";
import { trpc } from "@/lib/trpc";

type ResearchMetricsPayload = {
  positiveSymbols?: number;
  participatingSymbols?: number;
  benchmark?: {
    totalReturn?: number;
    maxDrawdown?: number;
    sharpeRatio?: number;
    equityCurve?: Array<{ time: number; equity: number }>;
    drawdownCurve?: Array<{ time: number; drawdown: number }>;
  };
  excessReturn?: number;
  drawdownAdvantage?: number;
};

type ResearchSourceSweep = {
  id?: string;
  name?: string;
  status?: string;
  engineVersion?: string;
  config?: unknown;
  createdAt?: string | null;
  completedAt?: string | null;
};

export default function ResearchResultPage({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = use(params);
  const resultQuery = trpc.research.getResult.useQuery({ resultId });
  const result = resultQuery.data;

  if (resultQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div
          className="h-8 w-56 animate-pulse rounded-lg"
          style={{ background: "var(--bg-input)" }}
        />
        <div className="glass-panel h-72 animate-pulse" />
      </div>
    );
  }

  if (!result) {
    return (
      <div
        className="flex flex-col items-center gap-4 py-20"
        style={{ color: "var(--text-muted)" }}
      >
        <p>Research result not found</p>
        <Link href="/research" style={{ color: "var(--accent)" }} className="text-sm">
          Back to research
        </Link>
      </div>
    );
  }

  const equityCurve = (result.portfolioEquityCurve as Array<{ time: number; equity: number }>).map(
    (point) => ({ time: point.time, value: point.equity })
  );
  const drawdownCurve = result.drawdownCurve as Array<{ time: number; drawdown: number }>;
  const testMetrics = result.testMetrics as ResearchMetricsPayload;
  const sourceSweep = parseSourceSweep(result.sourceSweep);
  const sourceConfig = parseRecord(sourceSweep?.config);
  const executionAssumptions = resolveResearchExecutionAssumptions(
    result.executionAssumptions ?? sourceConfig?.["executionAssumptions"]
  );
  const benchmarkCurve = (testMetrics.benchmark?.equityCurve ?? []).map((point) => ({
    time: point.time,
    value: point.equity,
  }));
  const benchmarkReturn = getMetricNumber(testMetrics.benchmark?.totalReturn);
  const excessReturn = getMetricNumber(testMetrics.excessReturn);
  const drawdownAdvantage = getMetricNumber(testMetrics.drawdownAdvantage);
  const alphaQualified = Boolean(result.alphaQualified);
  const paperBotEligible = Boolean(result.paperBotEligible);
  const benchmarkBeat = Boolean(result.benchmarkBeat);
  const perSymbol = result.perSymbolResults as Array<{
    symbol: string;
    candles: number;
    error?: string;
    splits?: {
      train?: { metrics: { totalReturn: number; maxDrawdown: number; totalTrades: number } };
      validation?: { metrics: { totalReturn: number; maxDrawdown: number; totalTrades: number } };
      test?: {
        metrics: {
          totalReturn: number;
          maxDrawdown: number;
          totalTrades: number;
          profitFactor: number;
        };
        benchmark?: { totalReturn?: number; maxDrawdown?: number };
      };
    };
    coverage?: { earliest: string | null; latest: string | null; totalCandles: number };
  }>;
  const evidenceAudit = summarizeResearchEvidenceAudit({
    perSymbol,
    qualified: result.qualified,
    alphaQualified,
    paperBotEligible,
    qualificationReasons: result.qualificationReasons as string[],
  });
  const backtestHref = buildResearchBacktestHref(result);
  const botHref = paperBotEligible ? buildResearchBotHref(result) : null;
  const statusTitle = getStatusTitle({
    qualified: result.qualified,
    alphaQualified,
    benchmarkBeat,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
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
            Research evidence
          </p>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            {result.strategyName} · {result.timeframe}
          </h1>
        </div>
      </div>

      <HistoricalEvidenceNotice />

      <div className="glass-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{
                background: result.qualified ? "var(--accent-dim)" : "rgba(248,113,113,0.1)",
                color: result.qualified ? "var(--accent)" : "var(--loss)",
              }}
            >
              {result.qualified ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            </div>
            <div>
              <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
                {statusTitle}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {(result.qualificationReasons as string[]).map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full px-3 py-1 text-xs"
                    style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}
                  >
                    {reason}
                  </span>
                ))}
                {result.qualified && !alphaQualified && excessReturn !== null && (
                  <span
                    className="rounded-full px-3 py-1 text-xs"
                    style={{ background: "rgba(251, 191, 36, 0.08)", color: "var(--accent)" }}
                  >
                    Benchmark lag {formatPercent(excessReturn)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={backtestHref}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <FlaskConical size={16} /> Manual backtest
            </Link>
            {botHref ? (
              <Link
                href={botHref}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
              >
                <Bot size={16} /> Paper bot draft
              </Link>
            ) : (
              <span
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
                title={
                  result.qualified
                    ? "Paper bot draft eligibility is loading from the research evidence."
                    : "Paper bot drafts require historical-profit gates."
                }
              >
                <Bot size={16} /> Bot draft locked
              </span>
            )}
          </div>
        </div>
      </div>

      {result.qualified && !alphaQualified && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{
            background: "rgba(251, 191, 36, 0.08)",
            color: "var(--text-secondary)",
            border: "1px solid rgba(251, 191, 36, 0.24)",
          }}
        >
          This result passes the historical-profit gates, but it underperforms equal-weight
          buy-and-hold on the same out-of-sample window. Paper mode remains available for forward
          observation, and the benchmark lag is attached to promotion evidence.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:grid-cols-11">
        <Metric
          label="OOS Return"
          value={formatPercent(result.outOfSampleReturn)}
          color={pnlColor(result.outOfSampleReturn)}
        />
        <Metric
          label="Benchmark"
          value={benchmarkReturn === null ? "n/a" : formatPercent(benchmarkReturn)}
          color={benchmarkReturn === null ? "var(--text-muted)" : pnlColor(benchmarkReturn)}
        />
        <Metric
          label="Excess"
          value={excessReturn === null ? "n/a" : formatPercent(excessReturn)}
          color={excessReturn === null ? "var(--text-muted)" : pnlColor(excessReturn)}
        />
        <Metric
          label="Max Drawdown"
          value={formatPercent(-result.maxDrawdown)}
          color="var(--loss)"
        />
        <Metric
          label="DD vs Bench"
          value={drawdownAdvantage === null ? "n/a" : formatPercent(drawdownAdvantage)}
          color={drawdownAdvantage === null ? "var(--text-muted)" : pnlColor(drawdownAdvantage)}
        />
        <Metric label="Sharpe" value={formatNumber(result.sharpeRatio, 2)} />
        <Metric label="Profit Factor" value={formatNumber(result.profitFactor, 2)} />
        <Metric label="Win Rate" value={formatPercent(result.winRate, 1)} />
        <Metric label="Trades" value={Math.round(result.totalTrades).toLocaleString()} />
        <Metric label="+ Symbols" value={`${getMetricCount(testMetrics.positiveSymbols)}/10`} />
        <Metric
          label="Participation"
          value={`${getMetricCount(testMetrics.participatingSymbols)}/10`}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AuditCard
          icon={Database}
          label="Source coverage"
          value={`${evidenceAudit.completeSymbols}/${evidenceAudit.symbolCount} symbols`}
          detail={`${formatCoverageWindow(evidenceAudit.earliestCoverage, evidenceAudit.latestCoverage)} · ${evidenceAudit.totalCandles.toLocaleString()} candles`}
          tone={evidenceAudit.failedSymbols > 0 ? "warn" : "pass"}
        />
        <AuditCard
          icon={GitBranch}
          label="Split discipline"
          value="70 / 15 / 15"
          detail="Chronological train, validation, and out-of-sample test windows"
        />
        <AuditCard
          icon={ShieldCheck}
          label="Execution model"
          value={`${formatCurrency(executionAssumptions.initialBalance, 0)} ${executionAssumptions.marketMode}`}
          detail={`Long/flat, maker ${formatRate(executionAssumptions.fees.maker)}, taker ${formatRate(
            executionAssumptions.fees.taker
          )}, slippage ${
            executionAssumptions.slippage.enabled
              ? formatRate(executionAssumptions.slippage.percentage)
              : "off"
          }`}
        />
        <AuditCard
          icon={result.qualified ? CheckCircle2 : XCircle}
          label="Gate audit"
          value={
            evidenceAudit.gateStatus === "passed"
              ? "All gates passed"
              : `${evidenceAudit.gateBlockers.length} blockers`
          }
          detail={
            evidenceAudit.promotionStatus === "locked"
              ? "Paper bot promotion locked"
              : evidenceAudit.promotionStatus === "alpha-qualified"
                ? "Paper eligible with benchmark alpha"
                : "Paper eligible, benchmark lag visible"
          }
          tone={evidenceAudit.gateStatus === "passed" ? "pass" : "fail"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel p-5">
          <h2 className="mb-4 text-lg" style={{ color: "var(--text-primary)" }}>
            Equal-weight test equity vs benchmark
          </h2>
          <PerformanceChart
            data={equityCurve}
            comparisonData={benchmarkCurve}
            seriesName="Strategy"
            comparisonName="Buy and hold"
            height={280}
          />
          <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Strategy</span>
            <span>Buy and hold</span>
          </div>
        </div>
        <div className="glass-panel p-5">
          <h2 className="mb-4 text-lg" style={{ color: "var(--text-primary)" }}>
            Test drawdown
          </h2>
          <DrawdownChart data={drawdownCurve} height={280} />
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="mb-4">
          <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
            Per-symbol split evidence
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Full available Binance history split chronologically into train, validation, and test.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th className="py-2 pr-3 text-left text-xs font-normal">Symbol</th>
                <th className="py-2 pr-3 text-left text-xs font-normal">Coverage</th>
                <th className="py-2 pr-3 text-right text-xs font-normal">Train</th>
                <th className="py-2 pr-3 text-right text-xs font-normal">Val</th>
                <th className="py-2 pr-3 text-right text-xs font-normal">Test</th>
                <th className="py-2 pr-3 text-right text-xs font-normal">B&H</th>
                <th className="py-2 pr-3 text-right text-xs font-normal">Excess</th>
                <th className="py-2 pr-3 text-right text-xs font-normal">PF</th>
                <th className="py-2 pr-3 text-right text-xs font-normal">Trades</th>
              </tr>
            </thead>
            <tbody>
              {perSymbol.map((row) => {
                const test = row.splits?.test?.metrics;
                const rowBenchmarkReturn = getMetricNumber(
                  row.splits?.test?.benchmark?.totalReturn
                );
                const rowExcessReturn =
                  test && rowBenchmarkReturn !== null
                    ? test.totalReturn - rowBenchmarkReturn
                    : null;
                return (
                  <tr key={row.symbol} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td className="py-3 pr-3" style={{ color: "var(--text-primary)" }}>
                      {row.symbol}
                    </td>
                    <td className="py-3 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {row.coverage?.earliest ? formatDateShort(row.coverage.earliest) : "n/a"} to{" "}
                      {row.coverage?.latest ? formatDateShort(row.coverage.latest) : "n/a"}
                    </td>
                    <td
                      className="py-3 pr-3 text-right tabular-nums"
                      style={{ color: pnlColor(row.splits?.train?.metrics.totalReturn ?? 0) }}
                    >
                      {row.splits?.train
                        ? formatPercent(row.splits.train.metrics.totalReturn)
                        : "failed"}
                    </td>
                    <td
                      className="py-3 pr-3 text-right tabular-nums"
                      style={{ color: pnlColor(row.splits?.validation?.metrics.totalReturn ?? 0) }}
                    >
                      {row.splits?.validation
                        ? formatPercent(row.splits.validation.metrics.totalReturn)
                        : "failed"}
                    </td>
                    <td
                      className="py-3 pr-3 text-right tabular-nums"
                      style={{ color: pnlColor(test?.totalReturn ?? 0) }}
                    >
                      {test ? formatPercent(test.totalReturn) : (row.error ?? "failed")}
                    </td>
                    <td
                      className="py-3 pr-3 text-right tabular-nums"
                      style={{
                        color:
                          rowBenchmarkReturn === null
                            ? "var(--text-muted)"
                            : pnlColor(rowBenchmarkReturn),
                      }}
                    >
                      {rowBenchmarkReturn === null ? "n/a" : formatPercent(rowBenchmarkReturn)}
                    </td>
                    <td
                      className="py-3 pr-3 text-right tabular-nums"
                      style={{
                        color:
                          rowExcessReturn === null
                            ? "var(--text-muted)"
                            : pnlColor(rowExcessReturn),
                      }}
                    >
                      {rowExcessReturn === null ? "n/a" : formatPercent(rowExcessReturn)}
                    </td>
                    <td
                      className="py-3 pr-3 text-right tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {test ? formatNumber(test.profitFactor, 2) : "n/a"}
                    </td>
                    <td
                      className="py-3 pr-3 text-right tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {test ? test.totalTrades.toLocaleString() : "0"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel p-5">
        <h2 className="mb-3 text-lg" style={{ color: "var(--text-primary)" }}>
          Exact configuration
        </h2>
        <pre
          className="overflow-x-auto rounded-lg p-4 text-xs"
          style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}
        >
          {JSON.stringify(
            {
              strategy: result.strategy,
              timeframe: result.timeframe,
              marketMode: result.marketMode,
              strategyParams: result.strategyParams,
              sourceSweep: sourceSweep
                ? {
                    id: sourceSweep.id,
                    name: sourceSweep.name,
                    status: sourceSweep.status,
                    engineVersion: sourceSweep.engineVersion,
                    completedAt: sourceSweep.completedAt,
                  }
                : null,
              sweepConfig: sourceConfig ?? null,
              executionAssumptions,
              benchmark: "equal-weight buy-and-hold over the same out-of-sample windows",
              dataSource: "Signal Harvester canonical candles / native rollups",
              universe: perSymbol.map((row) => row.symbol),
              split: {
                train: "first 70%",
                validation: "next 15%",
                outOfSample: "final 15%",
              },
              qualificationGates: {
                netReturn: "out-of-sample portfolio return > 0",
                profitFactor: "> 1.05",
                maxDrawdown: "<= 30%",
                trades: ">= 30 total trades",
                participation: ">= 6 symbols with non-trivial participation",
              },
              coverage: {
                completeSymbols: evidenceAudit.completeSymbols,
                failedSymbols: evidenceAudit.failedSymbols,
                earliest: evidenceAudit.earliestCoverage?.toISOString() ?? null,
                latest: evidenceAudit.latestCoverage?.toISOString() ?? null,
                totalCandles: evidenceAudit.totalCandles,
              },
              paperBotPromotion: paperBotEligible
                ? "eligible"
                : "locked until historical-profit gates pass",
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="glass-panel-sm p-4">
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-lg tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function AuditCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "pass" | "warn" | "fail";
}) {
  const toneColor =
    tone === "pass"
      ? "var(--accent)"
      : tone === "warn"
        ? "var(--accent)"
        : tone === "fail"
          ? "var(--loss)"
          : "var(--text-secondary)";

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} style={{ color: toneColor, flex: "0 0 auto" }} />
        <div className="min-w-0">
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {label}
          </div>
          <div className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {value}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMetricCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

function formatCoverageWindow(earliest: Date | null, latest: Date | null) {
  if (!earliest || !latest) return "coverage n/a";
  return `${formatDateShort(earliest.toISOString())} to ${formatDateShort(latest.toISOString())}`;
}

function getMetricNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatRate(value: number) {
  return `${formatNumber(value * 100, 2)}%`;
}

function getStatusTitle(input: {
  qualified: boolean;
  alphaQualified: boolean;
  benchmarkBeat: boolean;
}) {
  if (input.alphaQualified) return "Benchmark alpha";
  if (input.qualified) return "Historically profitable, benchmark lag";
  if (input.benchmarkBeat) return "Benchmark beater under review";
  return "Research candidate";
}

function parseSourceSweep(value: unknown): ResearchSourceSweep | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ResearchSourceSweep;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
