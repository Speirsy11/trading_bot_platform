"use client";

import { formatCurrency, formatPercent } from "@/lib/format";

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
    },
    {
      label: "Win Rate",
      value: formatPercent(metrics.winRate * 100),
      color: metrics.winRate >= 0.5 ? "var(--profit)" : "var(--loss)",
    },
    { label: "Total Trades", value: String(metrics.totalTrades) },
    { label: "Wins / Losses", value: `${metrics.wins} / ${metrics.losses}` },
    {
      label: "Avg Trade PnL",
      value: formatCurrency(metrics.averageTradePnl),
      color: metrics.averageTradePnl >= 0 ? "var(--profit)" : "var(--loss)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="glass-panel-sm p-4">
          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            {item.label}
          </div>
          <div
            className="text-lg tabular-nums font-light"
            style={{ color: item.color ?? "var(--text-primary)" }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
