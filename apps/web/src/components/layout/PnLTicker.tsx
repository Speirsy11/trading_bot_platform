"use client";

import { formatCurrency, formatPercent } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export function PnLTicker() {
  const { data } = trpc.portfolio.getSummary.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  if (!data || data.runningBots === 0 || data.totalPnl === 0) {
    return null;
  }

  const isProfit = data.totalPnl > 0;
  const color = isProfit ? "var(--profit)" : "var(--loss)";
  const background = isProfit ? "rgba(110, 231, 160, 0.10)" : "rgba(248, 113, 113, 0.10)";

  return (
    <div
      className="h-7 px-3 flex items-center rounded text-xs tabular-nums"
      style={{ color, background }}
    >
      PnL: {isProfit ? "+" : ""}
      {formatCurrency(data.totalPnl)} ({formatPercent(data.totalPnlPercent)})
    </div>
  );
}
