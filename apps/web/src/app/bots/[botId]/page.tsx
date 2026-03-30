"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BotControlPanel } from "@/components/bots/BotControlPanel";
import { BotMetrics } from "@/components/bots/BotMetrics";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { useBotStatus } from "@/hooks/useBotStatus";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function BotDetailPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const { data: bot, isLoading } = useBotStatus(botId);
  const { data: metrics } = trpc.bots.getMetrics.useQuery({ botId });
  const { data: tradesData } = trpc.bots.getTrades.useQuery({ botId, limit: 50, offset: 0 });
  const { data: logs } = trpc.bots.getLogs.useQuery({ botId, limit: 50 });

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

  const trades = tradesData ?? [];

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
        <BotControlPanel botId={botId} status={bot.status} />
      </ErrorBoundary>

      {metrics && (
        <ErrorBoundary>
          <BotMetrics metrics={metrics} />
        </ErrorBoundary>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-panel p-5">
          <h2 className="text-lg mb-4">Chart</h2>
          <CandlestickChart data={[]} height={300} />
        </div>

        <div className="glass-panel p-5">
          <h2 className="text-lg mb-4">Equity Curve</h2>
          <EquityCurve data={[]} height={300} />
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
