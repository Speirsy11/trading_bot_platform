"use client";

import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

interface BotMetricsProps {
  metrics: {
    status: string;
    currentBalance: number;
    totalPnl: number;
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    averageTradePnl: number;
    totalPnlPercent?: number;
    maxDrawdown?: number;
    profitFactor?: number | null;
    startedAt: string | null;
    lastTradeAt: string | null;
  };
}

export function BotMetrics({ metrics }: BotMetricsProps) {
  const items = [
    { label: "Balance", value: formatCurrency(metrics.currentBalance) },
    {
      label: "Total PnL",
      value: formatCurrency(metrics.totalPnl),
      color: metrics.totalPnl >= 0 ? "var(--profit)" : "var(--loss)",
      detail: metrics.totalPnlPercent != null ? formatPercent(metrics.totalPnlPercent) : undefined,
    },
    {
      label: "Win Rate",
      value: formatPercent(metrics.winRate),
      color: metrics.winRate >= 50 ? "var(--profit)" : "var(--loss)",
      tooltip: "Percentage of trades that were profitable.",
    },
    { label: "Total Trades", value: String(metrics.totalTrades) },
    {
      label: "Profit Factor",
      value:
        metrics.profitFactor == null
          ? metrics.wins > 0 && metrics.losses === 0
            ? "∞"
            : "n/a"
          : formatNumber(metrics.profitFactor, 2),
      tooltip: "Gross profit divided by gross loss across closed bot trades.",
    },
    {
      label: "Max Drawdown",
      value: formatPercent(-(metrics.maxDrawdown ?? 0)),
      color: (metrics.maxDrawdown ?? 0) > 0 ? "var(--loss)" : "var(--text-muted)",
      tooltip: "Largest peak-to-trough drop in realized bot equity.",
    },
    {
      label: "Avg Trade PnL",
      value: formatCurrency(metrics.averageTradePnl),
      color: metrics.averageTradePnl >= 0 ? "var(--profit)" : "var(--loss)",
      detail: `${metrics.wins} wins / ${metrics.losses} losses`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="glass-panel-sm p-4">
          <div className="text-xs mb-1 flex items-center" style={{ color: "var(--text-muted)" }}>
            {item.label}
            {"tooltip" in item && item.tooltip && (
              <MetricTooltip term={item.label} definition={item.tooltip} />
            )}
          </div>
          <div
            className="text-lg tabular-nums font-light"
            style={{ color: item.color ?? "var(--text-primary)" }}
          >
            {item.value}
          </div>
          {"detail" in item && item.detail && (
            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {item.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
