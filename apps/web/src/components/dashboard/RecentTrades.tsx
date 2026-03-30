"use client";

import { formatCurrency, pnlColor } from "@/lib/format";

export function RecentTrades() {
  // Trades would come from a tRPC query; for now showing empty state
  const trades: Array<{
    id: string;
    symbol: string;
    side: string;
    price: number;
    amount: number;
    pnl?: number;
    timestamp: number;
  }> = [];

  return (
    <div className="glass-panel p-5">
      <h2 className="text-lg mb-4">Recent Trades</h2>

      {trades.length === 0 ? (
        <div
          className="flex items-center justify-center py-12 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          No recent trades
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: "var(--bg-input)" }}
            >
              <div>
                <span
                  className="text-xs font-medium"
                  style={{
                    color: trade.side === "buy" ? "var(--profit)" : "var(--loss)",
                  }}
                >
                  {trade.side.toUpperCase()}
                </span>{" "}
                <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                  {trade.symbol}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatCurrency(trade.price)}
                </div>
                {trade.pnl !== undefined && (
                  <div className="text-xs tabular-nums" style={{ color: pnlColor(trade.pnl) }}>
                    {formatCurrency(trade.pnl)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
