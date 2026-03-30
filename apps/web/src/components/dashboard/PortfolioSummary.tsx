"use client";

import { formatCurrency, formatPercent, pnlColor } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export function PortfolioSummary() {
  const { data, error, isError, isLoading } = trpc.portfolio.getSummary.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-panel animate-pulse p-5 h-24" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-panel p-5 text-sm" style={{ color: "var(--loss)" }}>
        Failed to load portfolio summary: {error.message}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Value",
      value: formatCurrency(data?.totalValue ?? 0),
      icon: "◈",
    },
    {
      label: "Total PnL",
      value: formatCurrency(data?.totalPnl ?? 0),
      color: pnlColor(data?.totalPnl ?? 0),
      icon: "◇",
    },
    {
      label: "PnL %",
      value: formatPercent(data?.totalPnlPercent ?? 0),
      color: pnlColor(data?.totalPnlPercent ?? 0),
      icon: "△",
    },
    {
      label: "Active Bots",
      value: `${data?.runningBots ?? 0} / ${data?.botCount ?? 0}`,
      icon: "⬡",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs" style={{ color: "var(--accent)" }}>
              {card.icon}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {card.label}
            </span>
          </div>
          <div
            className="text-2xl font-light tabular-nums"
            style={{ color: card.color ?? "var(--text-primary)" }}
          >
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
