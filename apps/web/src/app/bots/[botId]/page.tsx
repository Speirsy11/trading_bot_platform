"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FlaskConical,
  Microscope,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { use, useMemo } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BotControlPanel } from "@/components/bots/BotControlPanel";
import { BotMetrics } from "@/components/bots/BotMetrics";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { useBotStatus } from "@/hooks/useBotStatus";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";

type PromotionEvidence = {
  sourceType?: "research" | "backtest";
  sourceId?: string;
  sourceSweepId?: string;
  sourceLabel?: string;
  benchmarkStatus?: string;
  alphaQualified?: boolean;
  paperBotEligible?: boolean;
  executionAssumptions?: ExecutionAssumptions;
  outOfSampleReturn?: number;
  benchmarkReturn?: number;
  excessReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  profitFactor?: number;
  totalTrades?: number;
  verifiedAt?: number;
};

type ExecutionAssumptions = {
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

type BotRuntimeMetrics = {
  status: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent?: number;
  maxDrawdown?: number;
  profitFactor?: number | null;
  startedAt: string | null;
  lastTradeAt: string | null;
};

type RiskConfig = {
  maxPositionSizePercent?: number;
  maxDrawdownPercent?: number;
  riskPerTradePercent?: number;
  maxDailyLossPercent?: number;
};

type ReadinessStatus = "pass" | "watch" | "fail";

type ReadinessCheck = {
  label: string;
  detail: string;
  status: ReadinessStatus;
};

export default function BotDetailPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const { data: bot, isLoading } = useBotStatus(botId);
  const { data: metrics, isLoading: metricsLoading } = trpc.bots.getMetrics.useQuery({ botId });

  // Fetch up to 500 trades for markers + equity curve
  const { data: tradesData } = trpc.bots.getTrades.useQuery({
    botId,
    limit: 500,
    offset: 0,
  });
  const { data: logsData } = trpc.bots.getLogs.useQuery({ botId, limit: 50 });
  const logs = logsData?.items;
  const promotionEvidence = bot?.promotionEvidence as PromotionEvidence | undefined;

  // Fetch candles using the bot's exchange / symbol / timeframe
  const { data: candleData, isLoading: candlesLoading } = trpc.market.getCandles.useQuery(
    {
      exchange: bot?.exchange ?? "",
      symbol: bot?.symbol ?? "",
      timeframe: bot?.timeframe ?? "1h",
      limit: 500,
    },
    { enabled: !!bot }
  );

  const equityCurveData = metrics?.equityCurve ?? [];
  const drawdownCurveData = metrics?.drawdownCurve ?? [];
  const readinessChecks = buildOperationalReadinessChecks({
    mode: bot?.mode,
    status: bot?.status,
    errorMessage: bot?.errorMessage,
    riskConfig: bot?.riskConfig as RiskConfig | undefined,
    promotionEvidence,
    metrics: metrics as BotRuntimeMetrics | undefined,
    candles: candleData,
    logs,
  });

  // Map trades to lightweight-charts series markers
  const tradeMarkers = useMemo(() => {
    if (!tradesData || tradesData.length === 0) return [];

    return tradesData
      .map((trade) => ({
        time: new Date(trade.executedAt).getTime(),
        position: trade.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
        color: trade.side === "buy" ? "#6ee7a0" : "#f87171",
        shape: trade.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
        text: trade.side === "buy" ? "B" : "S",
      }))
      .sort((a, b) => a.time - b.time);
  }, [tradesData]);

  // Show only the first 50 trades in the table
  const trades = tradesData?.slice(0, 50) ?? [];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-lg" style={{ background: "var(--bg-input)" }} />
        <div className="glass-panel h-64" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p style={{ color: "var(--text-muted)" }}>Bot not found</p>
        <Link href="/bots" style={{ color: "var(--accent)" }} className="text-sm">
          ← Back to bots
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/bots"
          className="rounded-lg p-2 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            {bot.name}
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {bot.strategy} · {bot.symbol} · {bot.exchange}
          </p>
        </div>
      </div>

      <ErrorBoundary>
        <BotControlPanel
          botId={botId}
          status={bot.status}
          mode={bot.mode}
          botName={bot.name}
          livePromotionLocked={Boolean(promotionEvidence?.sourceType && promotionEvidence.sourceId)}
        />
      </ErrorBoundary>

      {promotionEvidence?.sourceType && promotionEvidence.sourceId && (
        <PromotionEvidencePanel evidence={promotionEvidence} />
      )}

      <OperationalReadinessPanel checks={readinessChecks} mode={bot.mode} />

      {metrics && (
        <ErrorBoundary>
          <BotMetrics metrics={metrics} />
        </ErrorBoundary>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="glass-panel p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg">Price Action and Bot Fills</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {bot.exchange} · {bot.symbol} · {bot.timeframe} · Signal Harvester candles
              </p>
            </div>
            <div className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              {tradeMarkers.length} markers
            </div>
          </div>
          {candlesLoading ? (
            <div
              className="animate-pulse rounded-lg"
              style={{ height: 420, background: "var(--bg-input)" }}
            />
          ) : (
            <CandlestickChart
              data={candleData ?? []}
              height={420}
              markers={tradeMarkers.length > 0 ? tradeMarkers : undefined}
              showIndicatorControls
              showVolume
              defaultIndicators={["SMA", "EMA"]}
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-5">
            <div className="mb-4">
              <h2 className="text-lg">Realized Equity</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Server-calculated from all stored bot fills, not the visible table slice.
              </p>
            </div>
            {metricsLoading ? (
              <div
                className="animate-pulse rounded-lg"
                style={{ height: 210, background: "var(--bg-input)" }}
              />
            ) : (
              <EquityCurve data={equityCurveData} height={210} />
            )}
          </div>

          <div className="glass-panel p-5">
            <div className="mb-4">
              <h2 className="text-lg">Realized Drawdown</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Peak-to-trough decline across the bot equity curve.
              </p>
            </div>
            {metricsLoading ? (
              <div
                className="animate-pulse rounded-lg"
                style={{ height: 190, background: "var(--bg-input)" }}
              />
            ) : (
              <DrawdownChart data={drawdownCurveData} height={190} />
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel p-5">
        <h2 className="text-lg mb-4">Trade History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-2 font-normal text-xs">Side</th>
                <th className="text-left py-2 font-normal text-xs">Symbol</th>
                <th className="text-right py-2 font-normal text-xs">Price</th>
                <th className="text-right py-2 font-normal text-xs">Amount</th>
                <th className="text-right py-2 font-normal text-xs">Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No trades yet
                  </td>
                </tr>
              ) : (
                trades.map((trade, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td
                      className="py-2"
                      style={{ color: trade.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                    >
                      {trade.side?.toUpperCase()}
                    </td>
                    <td className="py-2" style={{ color: "var(--text-secondary)" }}>
                      {trade.symbol}
                    </td>
                    <td
                      className="py-2 text-right tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatCurrency(Number(trade.price) || 0)}
                    </td>
                    <td
                      className="py-2 text-right tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {trade.amount}
                    </td>
                    <td className="py-2 text-right text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatDate(trade.executedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {logs && logs.length > 0 && (
        <div className="glass-panel p-5">
          <h2 className="text-lg mb-4">Logs</h2>
          <div
            className="max-h-64 overflow-y-auto rounded-lg p-3 text-xs font-mono leading-5"
            style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}
          >
            {logs.map((log, i) => (
              <div key={i} className="py-0.5">
                <span style={{ color: "var(--text-muted)" }}>
                  {formatDate(log.createdAt ?? "")}
                </span>{" "}
                <span
                  style={{ color: log.level === "error" ? "var(--loss)" : "var(--text-secondary)" }}
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PromotionEvidencePanel({ evidence }: { evidence: PromotionEvidence }) {
  const isResearch = evidence.sourceType === "research";
  const href = isResearch ? `/research/${evidence.sourceId}` : `/backtest/${evidence.sourceId}`;
  const Icon = isResearch ? Microscope : FlaskConical;
  const chips = [
    evidence.sourceLabel,
    evidence.benchmarkStatus ? formatBenchmarkStatus(evidence.benchmarkStatus) : null,
    evidence.excessReturn != null ? `Excess ${formatSignedPercent(evidence.excessReturn)}` : null,
    evidence.outOfSampleReturn != null
      ? `Return ${formatSignedPercent(evidence.outOfSampleReturn)}`
      : null,
    evidence.maxDrawdown != null ? `DD -${evidence.maxDrawdown.toFixed(2)}%` : null,
    evidence.totalTrades != null ? `${evidence.totalTrades.toLocaleString()} trades` : null,
    evidence.executionAssumptions
      ? formatExecutionAssumptionsChip(evidence.executionAssumptions)
      : null,
    evidence.executionAssumptions ? formatExecutionCostChip(evidence.executionAssumptions) : null,
  ].filter((chip): chip is string => Boolean(chip));

  return (
    <div className="glass-panel p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
              Promotion Evidence
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              This paper bot was created from {isResearch ? "research" : "a backtest"} evidence.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full px-3 py-1 text-xs"
                  style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <Icon size={16} />
          Open source evidence
        </Link>
      </div>
    </div>
  );
}

function OperationalReadinessPanel({ checks, mode }: { checks: ReadinessCheck[]; mode?: string }) {
  const passedCount = checks.filter((check) => check.status === "pass").length;
  const blockedCount = checks.filter((check) => check.status === "fail").length;
  const statusLabel =
    blockedCount > 0
      ? "Needs attention"
      : passedCount === checks.length
        ? "Paper evidence clear"
        : "Paper evidence building";

  return (
    <div className="glass-panel p-5">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              background: blockedCount > 0 ? "rgba(248, 113, 113, 0.10)" : "var(--accent-dim)",
              color: blockedCount > 0 ? "var(--loss)" : "var(--accent)",
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
              Operational Readiness
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {statusLabel} · {mode === "paper" ? "paper mode" : `${mode ?? "unknown"} mode`}
            </p>
          </div>
        </div>
        <div className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {passedCount}/{checks.length} clear
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => {
          const style = readinessStyle(check.status);
          return (
            <div
              key={check.label}
              className="flex min-h-[74px] gap-2 rounded-lg p-3"
              style={{
                background: style.background,
                border: `1px solid ${style.border}`,
              }}
            >
              <div className="mt-0.5 shrink-0" style={{ color: style.color }}>
                {check.status === "pass" ? <Check size={14} /> : <AlertTriangle size={14} />}
              </div>
              <div className="min-w-0">
                <div className="text-xs" style={{ color: "var(--text-primary)" }}>
                  {check.label}
                </div>
                <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                  {check.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildOperationalReadinessChecks(input: {
  mode?: string;
  status?: string;
  errorMessage?: string | null;
  riskConfig?: RiskConfig;
  promotionEvidence?: PromotionEvidence;
  metrics?: BotRuntimeMetrics;
  candles?: Array<{ time: number }>;
  logs?: Array<{ level?: string | null; createdAt?: string | null }>;
}): ReadinessCheck[] {
  const evidence = input.promotionEvidence;
  const metrics = input.metrics;
  const risk = input.riskConfig ?? {};
  const latestCandleTime = latestTimestamp(input.candles?.map((candle) => candle.time) ?? []);
  const latestLog = latestTimestamp(
    input.logs?.map((log) => (log.createdAt ? Date.parse(log.createdAt) : 0)) ?? []
  );
  const recentErrors =
    input.errorMessage || input.logs?.some((log) => log.level === "error") ? true : false;
  const maxDrawdown = metrics?.maxDrawdown ?? 0;
  const profitFactor = metrics?.profitFactor;
  const riskTight =
    (risk.maxPositionSizePercent ?? 100) <= 10 &&
    (risk.riskPerTradePercent ?? 100) <= 2 &&
    (risk.maxDailyLossPercent ?? 100) <= 5;

  return [
    {
      label: "Execution mode",
      detail:
        input.mode === "paper"
          ? "Orders are simulated while evidence accumulates."
          : "Live execution requires a separate promotion workflow.",
      status: input.mode === "paper" ? "pass" : "fail",
    },
    {
      label: "Source evidence",
      detail: evidence?.sourceId
        ? `${evidence.sourceLabel ?? evidence.sourceType} · ${formatBenchmarkStatus(
            evidence.benchmarkStatus
          )}`
        : "No research or backtest source is attached.",
      status: evidence?.sourceId ? "pass" : "watch",
    },
    {
      label: "Execution assumptions",
      detail: evidence?.executionAssumptions
        ? formatExecutionAssumptions(evidence.executionAssumptions)
        : "No source fee/slippage assumptions attached.",
      status: evidence?.executionAssumptions ? "pass" : "watch",
    },
    {
      label: "Realized sample",
      detail:
        metrics && metrics.totalTrades > 0
          ? `${metrics.totalTrades.toLocaleString()} fills · ${metrics.wins} wins / ${
              metrics.losses
            } losses`
          : "No paper fills yet.",
      status:
        metrics && metrics.totalTrades >= 30 ? "pass" : metrics?.totalTrades ? "watch" : "watch",
    },
    {
      label: "Drawdown discipline",
      detail: `${formatSignedPercent(-maxDrawdown)} realized max drawdown`,
      status: maxDrawdown <= 20 ? "pass" : maxDrawdown <= 30 ? "watch" : "fail",
    },
    {
      label: "Profit factor",
      detail:
        profitFactor == null
          ? metrics && metrics.wins > 0 && metrics.losses === 0
            ? "No losing fills yet"
            : "Waiting for closed fill history"
          : `${profitFactor.toFixed(2)} realized PF`,
      status: profitFactor == null ? "watch" : profitFactor > 1.05 ? "pass" : "watch",
    },
    {
      label: "Risk caps",
      detail: `${risk.maxPositionSizePercent ?? "n/a"}% max position · ${
        risk.riskPerTradePercent ?? "n/a"
      }% risk/trade`,
      status: riskTight ? "pass" : "watch",
    },
    {
      label: "Market data",
      detail: latestCandleTime
        ? `Latest candle ${formatAge(latestCandleTime)}`
        : "No candles loaded",
      status:
        latestCandleTime && Date.now() - latestCandleTime < 6 * 60 * 60 * 1000 ? "pass" : "watch",
    },
    {
      label: "Runtime health",
      detail: recentErrors
        ? (input.errorMessage ?? "Recent error log present")
        : latestLog
          ? `Last log ${formatAge(latestLog)}`
          : "No recent error state",
      status: recentErrors ? "fail" : "pass",
    },
  ];
}

function readinessStyle(status: ReadinessStatus) {
  if (status === "pass") {
    return {
      background: "rgba(110, 231, 160, 0.08)",
      border: "rgba(110, 231, 160, 0.22)",
      color: "var(--profit)",
    };
  }

  if (status === "fail") {
    return {
      background: "rgba(248, 113, 113, 0.08)",
      border: "rgba(248, 113, 113, 0.22)",
      color: "var(--loss)",
    };
  }

  return {
    background: "rgba(251, 191, 36, 0.08)",
    border: "rgba(251, 191, 36, 0.22)",
    color: "var(--accent)",
  };
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatExecutionAssumptions(value: ExecutionAssumptions) {
  const slippage = value.slippage.enabled ? formatRate(value.slippage.percentage) : "off";
  return `${value.marketMode} · ${formatCurrency(value.initialBalance, 0)} · maker ${formatRate(
    value.fees.maker
  )} / taker ${formatRate(value.fees.taker)} · slip ${slippage}`;
}

function formatExecutionAssumptionsChip(value: ExecutionAssumptions) {
  return `${value.marketMode} ${formatCurrency(value.initialBalance, 0)}`;
}

function formatExecutionCostChip(value: ExecutionAssumptions) {
  const slippage = value.slippage.enabled ? formatRate(value.slippage.percentage) : "off";
  return `Fees ${formatRate(value.fees.maker)}/${formatRate(value.fees.taker)} · slip ${slippage}`;
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatBenchmarkStatus(value?: string) {
  if (value === "alpha-qualified") return "Benchmark alpha";
  if (value === "profit-only") return "Historical profit";
  if (value === "benchmark-beater") return "Benchmark beater";
  if (value === "research") return "Research candidate";
  return value ?? "Historical evidence";
}

function latestTimestamp(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  return valid.length > 0 ? Math.max(...valid) : null;
}

function formatAge(timestamp: number) {
  const ageMs = Math.max(Date.now() - timestamp, 0);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
