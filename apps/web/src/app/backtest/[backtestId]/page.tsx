"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { EquityCurve } from "@/components/charts/EquityCurve";
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
  const equityCurve = (metrics.equityCurve ?? []) as { time: number; equity: number }[];
  const drawdownCurve = (metrics.drawdownCurve ?? []) as { time: number; drawdown: number }[];
  const trades = (metrics.trades ?? []) as Record<string, unknown>[];

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
    { label: "Sharpe Ratio", value: (Number(results.sharpeRatio) || 0).toFixed(2) },
    {
      label: "Max Drawdown",
      value: formatPercent(-(Number(results.maxDrawdown) || 0)),
      color: "var(--loss)",
    },
    { label: "Win Rate", value: formatPercent((Number(results.winRate) || 0) * 100) },
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

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {metricsCards.map((m) => (
          <div key={m.label} className="glass-panel-sm p-4">
            <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              {m.label}
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
