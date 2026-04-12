"use client";

import { Activity } from "lucide-react";
import { useEffect } from "react";

import { formatCurrency, pnlColor } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/providers/SocketProvider";

export function RecentTrades() {
  const { data: trades, isLoading } = trpc.bots.getRecentTrades.useQuery({ limit: 10 });
  const utils = trpc.useUtils();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.emit("subscribe", { type: "trades:all" });

    const handleTrade = () => {
      void utils.bots.getRecentTrades.invalidate();
    };
    socket.on("bot:trade", handleTrade);

    return () => {
      socket.off("bot:trade", handleTrade);
      socket.emit("unsubscribe", { type: "trades:all" });
    };
  }, [socket, utils]);

  if (isLoading) {
    return (
      <div className="glass-panel p-5">
        <h2 className="text-lg mb-4">Recent Trades</h2>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg px-3 py-2 h-10"
              style={{ background: "var(--bg-input)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  const tradeList = trades ?? [];

  return (
    <div className="glass-panel p-5">
      <h2 className="text-lg mb-4">Recent Trades</h2>

      {tradeList.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-12 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <Activity size={24} />
          <p className="text-sm">No trades yet. Start a bot to see activity here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tradeList.map((trade) => (
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
                {trade.pnl != null && (
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
