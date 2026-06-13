"use client";

import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, GitBranch } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { formatCurrency, formatPercent, pnlColor, formatDate, formatDateShort } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function BacktestResultsPage({
  params,
}: {
  params: Promise<{ backtestId: string }>;
}) {
  const { backtestId } = use(params);
  const resultsQuery = trpc.backtest.getResults.useQuery({ backtestId });
  const statusQuery = trpc.backtest.getStatus.useQuery({ backtestId });
  const results = resultsQuery.data;
  const status = statusQuery.data;
  const isLoading = resultsQuery.isLoading || statusQuery.isLoading;
  const chartQuery = trpc.market.getChartSnapshot.useQuery(
    {
      exchange: results?.exchange ?? "",
      symbol: results?.symbol ?? "",
      timeframe: results?.timeframe ?? "",
      startTime: results ? Date.parse(results.startTime) : undefined,
      endTime: results ? Date.parse(results.endTime) : undefined,
      limit: 1200,
    },
    {
      enabled: Boolean(results?.exchange && results.symbol && results.timeframe),
      staleTime: 60_000,
    }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div
          className="h-8 w-48 rounded-lg animate-pulse"
          style={{ background: "var(--bg-input)" }}
        />
        <div className="glass-panel h-64 animate-pulse" />
      </div>
    );
  }

  if (status?.status === "running" || status?.status === "pending") {
    const progressPercent = normalizeProgress(status?.progress);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/backtest"
            aria-label="Back to backtests"
            className="rounded-lg p-2"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            Backtest Running
          </h1>
        </div>
        <div className="glass-panel flex flex-col items-center justify-center gap-4 p-12">
          <div
            className="h-2 w-64 rounded-full overflow-hidden"
            style={{ background: "var(--bg-input)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                background: "var(--accent)",
              }}
            />
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {Math.round(progressPercent)}% complete
          </p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div
        className="flex flex-col items-center gap-4 py-20"
        style={{ color: "var(--text-muted)" }}
      >
        <p>Backtest not found</p>
        <Link href="/backtest" style={{ color: "var(--accent)" }} className="text-sm">
          ← Back
        </Link>
      </div>
    );
  }

  const metrics = (results.metrics ?? {}) as Record<string, unknown>;
  const sourceEvidence = parseSourceEvidence(metrics.sourceEvidence);
  const storedResult = (metrics.result ?? {}) as Record<string, unknown>;
  const equityCurve = (
    (storedResult.equityCurve ?? metrics.equityCurve ?? []) as {
      time: number;
      equity: number;
    }[]
  ).map((point) => ({ time: point.time, equity: point.equity }));
  const drawdownCurve = (
    (storedResult.drawdownCurve ?? metrics.drawdownCurve ?? []) as {
      time: number;
      drawdown: number;
    }[]
  ).map((point) => ({ time: point.time, drawdown: point.drawdown }));
  const benchmark = parseBacktestBenchmark(storedResult.benchmark);
  const benchmarkCurve =
    benchmark?.equityCurve?.map((point) => ({ time: point.time, value: point.equity })) ?? [];
  const performanceCurve = equityCurve.map((point) => ({ time: point.time, value: point.equity }));
  const benchmarkReturn = readOptionalNumber(benchmark?.totalReturn);
  const excessReturn =
    readOptionalNumber(storedResult.excessReturn) ??
    (benchmarkReturn === null ? null : (Number(results.totalPnlPercent) || 0) - benchmarkReturn);
  const benchmarkDrawdown = readOptionalNumber(benchmark?.maxDrawdown);
  const trades = (storedResult.trades ?? metrics.trades ?? results.trades ?? []) as Record<
    string,
    unknown
  >[];
  const orderFills = (storedResult.orderFills ?? metrics.orderFills ?? []) as Record<
    string,
    unknown
  >[];
  const tradeMarkers = buildTradeMarkers(orderFills.length > 0 ? orderFills : trades);
  const chartCoverage = chartQuery.data?.coverage;
  const promotionHref = buildPromotionHref(backtestId, results);
  const readiness = getPromotionReadiness(results);

  const metricsCards = [
    {
      label: "Total Return",
      value: formatPercent(Number(results.totalPnlPercent) || 0),
      color: pnlColor(Number(results.totalPnlPercent) || 0),
    },
    {
      label: "Benchmark",
      value: benchmarkReturn === null ? "n/a" : formatPercent(benchmarkReturn),
      color: benchmarkReturn === null ? "var(--text-muted)" : pnlColor(benchmarkReturn),
      tooltip:
        "Buy-and-hold return for the same symbol, candle window, fees, and slippage assumptions.",
    },
    {
      label: "Excess Return",
      value: excessReturn === null ? "n/a" : formatPercent(excessReturn),
      color: excessReturn === null ? "var(--text-muted)" : pnlColor(excessReturn),
      tooltip: "Strategy return minus the same-window buy-and-hold benchmark return.",
    },
    {
      label: "Total PnL",
      value: formatCurrency(Number(results.totalPnl) || 0),
      color: pnlColor(Number(results.totalPnl) || 0),
    },
    {
      label: "Sharpe Ratio",
      value: (Number(results.sharpeRatio) || 0).toFixed(2),
      tooltip:
        "Risk-adjusted return (return divided by volatility). Above 1.0 is acceptable, above 2.0 is good.",
    },
    {
      label: "Max Drawdown",
      value: formatPercent(-(Number(results.maxDrawdown) || 0)),
      color: "var(--loss)",
      detail: benchmarkDrawdown === null ? undefined : `Bench ${formatPercent(-benchmarkDrawdown)}`,
      tooltip: "Largest peak-to-trough decline. A measure of downside risk.",
    },
    {
      label: "Win Rate",
      value: formatPercent(Number(results.winRate) || 0),
      tooltip: "Percentage of trades that were profitable.",
    },
    { label: "Total Trades", value: String(results.totalTrades ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/backtest"
          aria-label="Back to backtests"
          className="rounded-lg p-2"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            {results.name ?? "Backtest Results"}
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {results.strategy} · {results.symbol}
          </p>
        </div>
      </div>

      {sourceEvidence && <SourceEvidencePanel evidence={sourceEvidence} />}

      <div className="glass-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: readiness.good ? "var(--accent-dim)" : "rgba(248,113,113,0.1)" }}
            >
              {readiness.good ? (
                <CheckCircle2 size={20} style={{ color: "var(--accent)" }} />
              ) : (
                <AlertTriangle size={20} style={{ color: "var(--loss)" }} />
              )}
            </div>
            <div>
              <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
                {readiness.title}
              </h2>
              <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
                {readiness.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {readiness.checks.map((check) => (
                  <span
                    key={check}
                    className="rounded-full px-3 py-1 text-xs"
                    style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}
                  >
                    {check}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Link
            href={promotionHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm"
            style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
          >
            <Bot size={16} /> Create paper bot from this backtest
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {metricsCards.map((m) => (
          <div key={m.label} className="glass-panel-sm p-4">
            <div className="text-xs mb-1 flex items-center" style={{ color: "var(--text-muted)" }}>
              {m.label}
              {"tooltip" in m && m.tooltip && (
                <MetricTooltip term={m.label} definition={m.tooltip} />
              )}
            </div>
            <div
              className="text-lg tabular-nums font-light"
              style={{ color: m.color ?? "var(--text-primary)" }}
            >
              {m.value}
            </div>
            {"detail" in m && m.detail && (
              <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {m.detail}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <ErrorBoundary>
        <div className="glass-panel p-5">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
                Price Action and Trades
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {chartQuery.isError
                  ? chartQuery.error.message
                  : `${chartQuery.data?.candles.length ?? 0} Harvester candles · ${tradeMarkers.length} trade markers`}
              </p>
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {chartCoverage?.earliest && chartCoverage.latest
                ? `${formatDateShort(chartCoverage.earliest)} → ${formatDateShort(chartCoverage.latest)}`
                : `${results.exchange} · ${results.timeframe}`}
            </div>
          </div>
          <CandlestickChart
            data={chartQuery.data?.candles ?? []}
            height={460}
            markers={tradeMarkers}
            showVolume
            showIndicatorControls
            defaultIndicators={["SMA", "EMA"]}
            indicators={{
              sma: { period: 20, color: "#c8a55a" },
              ema: { period: 50, color: "#5ab8c8" },
            }}
          />
        </div>
      </ErrorBoundary>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ErrorBoundary>
          <div className="glass-panel p-5">
            <h2 className="text-lg mb-4">Equity vs Buy-and-Hold</h2>
            <PerformanceChart
              data={performanceCurve}
              comparisonData={benchmarkCurve}
              seriesName="Strategy"
              comparisonName="Buy and hold"
              height={280}
            />
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="glass-panel p-5">
            <h2 className="text-lg mb-4">Drawdown</h2>
            <DrawdownChart data={drawdownCurve} height={280} />
          </div>
        </ErrorBoundary>
      </div>

      {/* Trades */}
      <div className="glass-panel p-5">
        <h2 className="text-lg mb-4">Closed Trades</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-2 font-normal text-xs">Side</th>
                <th className="text-right py-2 font-normal text-xs">Entry</th>
                <th className="text-right py-2 font-normal text-xs">Exit</th>
                <th className="text-right py-2 font-normal text-xs">PnL</th>
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
                    No trades
                  </td>
                </tr>
              ) : (
                trades.map((t: Record<string, unknown>, i: number) => {
                  const tradeSide = String(t.side ?? "").toLowerCase();
                  const sideColor =
                    tradeSide === "buy" || tradeSide === "long"
                      ? "var(--profit)"
                      : tradeSide === "sell" || tradeSide === "short"
                        ? "var(--loss)"
                        : "var(--text-muted)";

                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td className="py-2" style={{ color: sideColor }}>
                        {tradeSide ? tradeSide.toUpperCase() : "—"}
                      </td>
                      <td
                        className="py-2 text-right tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatCurrency(Number(t.entryPrice) || 0)}
                      </td>
                      <td
                        className="py-2 text-right tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatCurrency(Number(t.exitPrice) || 0)}
                      </td>
                      <td
                        className="py-2 text-right tabular-nums"
                        style={{ color: pnlColor(Number(t.pnl) || 0) }}
                      >
                        {formatCurrency(Number(t.pnl) || 0)}
                      </td>
                      <td
                        className="py-2 text-right text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t.timestamp ? formatDate(t.timestamp as number) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type SourceEvidence = {
  sourceType: "research";
  sourceId: string;
  sourceLabel?: string;
  benchmarkStatus?: string;
  qualified?: boolean;
  alphaQualified?: boolean;
  outOfSampleReturn?: number | null;
  benchmarkReturn?: number | null;
  excessReturn?: number | null;
  verifiedAt?: number | null;
};

function SourceEvidencePanel({ evidence }: { evidence: SourceEvidence }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4 text-sm lg:flex-row lg:items-center lg:justify-between"
      style={{
        background: "rgba(200, 165, 90, 0.10)",
        color: "var(--text-secondary)",
        border: "1px solid rgba(200, 165, 90, 0.24)",
      }}
    >
      <div className="flex items-start gap-3">
        <GitBranch size={18} style={{ color: "var(--accent)" }} />
        <div>
          <div style={{ color: "var(--text-primary)" }}>
            Replayed from {evidence.sourceLabel ?? "research evidence"}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {formatBenchmarkStatus(evidence.benchmarkStatus)} · OOS{" "}
            {formatOptionalPercent(evidence.outOfSampleReturn)} · Excess{" "}
            {formatOptionalPercent(evidence.excessReturn)}
          </div>
        </div>
      </div>
      <Link
        href={`/research/${evidence.sourceId}`}
        className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs"
        style={{
          background: "var(--bg-input)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      >
        Open source result
      </Link>
    </div>
  );
}

type BacktestResultForPromotion = {
  name?: string | null;
  strategy: string;
  strategyParams?: unknown;
  exchange: string;
  symbol: string;
  timeframe: string;
  riskConfig?: unknown;
  initialBalance?: number | null;
  totalPnlPercent?: number | null;
  maxDrawdown?: number | null;
  totalTrades?: number | null;
  sharpeRatio?: number | null;
};

function parseSourceEvidence(value: unknown): SourceEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.sourceType !== "research" || typeof record.sourceId !== "string") return null;
  return {
    sourceType: "research",
    sourceId: record.sourceId,
    sourceLabel: typeof record.sourceLabel === "string" ? record.sourceLabel : undefined,
    benchmarkStatus:
      typeof record.benchmarkStatus === "string" ? record.benchmarkStatus : undefined,
    qualified: typeof record.qualified === "boolean" ? record.qualified : undefined,
    alphaQualified: typeof record.alphaQualified === "boolean" ? record.alphaQualified : undefined,
    outOfSampleReturn: readOptionalNumber(record.outOfSampleReturn),
    benchmarkReturn: readOptionalNumber(record.benchmarkReturn),
    excessReturn: readOptionalNumber(record.excessReturn),
    verifiedAt: readOptionalNumber(record.verifiedAt),
  };
}

type BacktestBenchmark = {
  totalReturn?: number;
  maxDrawdown?: number;
  finalBalance?: number;
  equityCurve?: Array<{ time: number; equity: number }>;
};

function parseBacktestBenchmark(value: unknown): BacktestBenchmark | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as BacktestBenchmark;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatOptionalPercent(value: number | null | undefined) {
  return value == null ? "n/a" : formatPercent(value);
}

function formatBenchmarkStatus(value?: string) {
  if (value === "alpha-qualified") return "Benchmark alpha";
  if (value === "profit-only") return "Historical profit";
  if (value === "benchmark-beater") return "Benchmark beater";
  if (value === "research") return "Research";
  return value ?? "Research";
}

function normalizeProgress(value: number | null | undefined) {
  const progress = Number(value ?? 0);
  if (!Number.isFinite(progress)) return 0;
  const percent = progress <= 1 ? progress * 100 : progress;
  return Math.min(Math.max(percent, 0), 100);
}

function buildPromotionHref(backtestId: string, results: BacktestResultForPromotion) {
  const params = new URLSearchParams({
    sourceBacktest: backtestId,
    mode: "paper",
    strategy: results.strategy,
    exchange: results.exchange,
    symbol: results.symbol,
    timeframe: results.timeframe,
    name: `${results.name ?? results.strategy} paper run`,
    balance: String(results.initialBalance ?? 10000),
  });

  if (results.strategyParams) params.set("strategyParams", JSON.stringify(results.strategyParams));
  if (results.riskConfig) params.set("riskConfig", JSON.stringify(results.riskConfig));

  return `/bots/new?${params.toString()}`;
}

function getPromotionReadiness(results: BacktestResultForPromotion) {
  const totalReturn = Number(results.totalPnlPercent) || 0;
  const maxDrawdown = Number(results.maxDrawdown) || 0;
  const totalTrades = Number(results.totalTrades) || 0;
  const sharpe = Number(results.sharpeRatio) || 0;
  const good = totalReturn > 0 && maxDrawdown <= 20 && totalTrades >= 5;

  return {
    good,
    title: good ? "Ready for a paper-trading trial" : "Paper-trade this before trusting it",
    description: good
      ? "This backtest clears the first sanity checks. Launch it in paper mode next so the same strategy config can prove itself on live market data without risking capital."
      : "The result is not strong enough for live capital yet. You can still promote it to paper mode to observe behaviour, but treat it as research, not approval.",
    checks: [
      `${formatPercent(totalReturn)} return`,
      `${formatPercent(-maxDrawdown)} max drawdown`,
      `${totalTrades} trades`,
      `${sharpe.toFixed(2)} Sharpe`,
    ],
  };
}

type TradeMarker = {
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle";
  text: string;
};

function buildTradeMarkers(trades: Record<string, unknown>[]): TradeMarker[] {
  return trades.flatMap((trade, index) => {
    const side = String(trade.side ?? "").toLowerCase();
    const entryTimestamp = timeFromTrade(trade.entryTimestamp);
    const exitTimestamp = timeFromTrade(trade.timestamp ?? trade.executedAt);
    const pnl = numberFromTrade(trade.pnl) ?? 0;
    const entryPrice = numberFromTrade(trade.entryPrice);
    const exitPrice = numberFromTrade(trade.exitPrice ?? trade.price);
    const markers: TradeMarker[] = [];

    if (entryTimestamp) {
      markers.push({
        time: entryTimestamp,
        position: "belowBar",
        color: "#6ee7a0",
        shape: "arrowUp",
        text: entryPrice ? `Entry ${formatCurrency(entryPrice, 2)}` : `Entry #${index + 1}`,
      });
    }

    if (exitTimestamp) {
      if (!entryTimestamp && side === "buy") {
        markers.push({
          time: exitTimestamp,
          position: "belowBar",
          color: "#6ee7a0",
          shape: "arrowUp",
          text: exitPrice ? `Buy ${formatCurrency(exitPrice, 2)}` : `Buy #${index + 1}`,
        });
        return markers;
      }

      if (!entryTimestamp && side === "sell") {
        markers.push({
          time: exitTimestamp,
          position: "aboveBar",
          color: "#f87171",
          shape: "arrowDown",
          text: exitPrice ? `Sell ${formatCurrency(exitPrice, 2)}` : `Sell #${index + 1}`,
        });
        return markers;
      }

      markers.push({
        time: exitTimestamp,
        position: pnl >= 0 ? "aboveBar" : "belowBar",
        color: pnl >= 0 ? "#6ee7a0" : "#f87171",
        shape: pnl >= 0 ? "arrowDown" : "circle",
        text: `${pnl >= 0 ? "+" : ""}${formatCurrency(pnl, 2)}${exitPrice ? ` @ ${formatCurrency(exitPrice, 2)}` : ""}`,
      });
    }

    return markers;
  });
}

function numberFromTrade(value: unknown): number | null {
  if (typeof value === "string" && value.trim()) {
    const parsedNumber = Number(value);
    return Number.isFinite(parsedNumber) ? parsedNumber : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function timeFromTrade(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" && value.trim()) {
    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return parsedDate;
    return numberFromTrade(value);
  }
  return numberFromTrade(value);
}
