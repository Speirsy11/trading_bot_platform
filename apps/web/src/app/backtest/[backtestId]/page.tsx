"use client";

import { AlertTriangle, ArrowLeft, Bot, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { formatCurrency, formatPercent, pnlColor, formatDate } from "@/lib/format";
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
                width: `${(status?.progress ?? 0) * 100}%`,
                background: "var(--accent)",
              }}
            />
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {Math.round((status?.progress ?? 0) * 100)}% complete
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
  const trades = (storedResult.trades ?? metrics.trades ?? []) as Record<string, unknown>[];
  const promotionHref = buildPromotionHref(backtestId, results);
  const readiness = getPromotionReadiness(results);

  const metricsCards = [
    {
      label: "Total Return",
      value: formatPercent(Number(results.totalPnlPercent) || 0),
      color: pnlColor(Number(results.totalPnlPercent) || 0),
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
      tooltip: "Largest peak-to-trough decline. A measure of downside risk.",
    },
    {
      label: "Win Rate",
      value: formatPercent((Number(results.winRate) || 0) * 100),
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ErrorBoundary>
          <div className="glass-panel p-5">
            <h2 className="text-lg mb-4">Equity Curve</h2>
            <EquityCurve data={equityCurve} height={280} />
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
        <h2 className="text-lg mb-4">Trades</h2>
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
