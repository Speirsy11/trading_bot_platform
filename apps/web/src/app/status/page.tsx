"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { formatCurrency, formatRelative } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const REFRESH_INTERVAL_MS = 60_000;

type HealthData = {
  status: "ok" | "degraded";
  db: "ok" | "error";
  redis: "ok" | "error";
  uptime: number;
  version?: string;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: ok ? "var(--profit)" : "var(--loss)" }}
    />
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        background: ok
          ? "rgba(var(--profit-rgb, 34,197,94), 0.12)"
          : "rgba(var(--loss-rgb, 239,68,68), 0.12)",
        color: ok ? "var(--profit)" : "var(--loss)",
      }}
    >
      <StatusDot ok={ok} />
      {label}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel p-5 space-y-4">
      <h2 className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshTick, setRefreshTick] = useState(0);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      const data = (await res.json()) as HealthData;
      setHealth(data);
      setHealthError(false);
    } catch {
      setHealth(null);
      setHealthError(true);
    }
    setLastRefreshed(new Date());
  }, []);

  // Trigger a manual refresh
  const handleRefresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    void fetchHealth();
    const id = setInterval(() => void fetchHealth(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
    // mount-only: fetchHealth is stable, refreshTick is intentional
  }, [refreshTick]);

  // tRPC queries — re-fetched on refreshTick via queryKey
  const { data: summary } = trpc.portfolio.getSummary.useQuery(undefined, {
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const { data: recentTrades } = trpc.bots.getRecentTrades.useQuery(
    { limit: 3 },
    { refetchInterval: REFRESH_INTERVAL_MS }
  );

  const { data: candles } = trpc.market.getCandles.useQuery(
    { exchange: "binance", symbol: "BTC/USDT", timeframe: "1h", limit: 1 },
    { refetchInterval: REFRESH_INTERVAL_MS, retry: false }
  );

  const latestCandle = candles?.[candles.length - 1];

  const apiOk = !healthError && health?.status === "ok";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
            System Status
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Last updated {formatRelative(lastRefreshed)} &mdash; auto-refreshes every 60s
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
          style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* API Health */}
      <SectionCard title="API Health">
        <div className="flex items-center gap-3">
          <StatusBadge ok={apiOk} label={apiOk ? "Operational" : "Degraded"} />
          {health?.version && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              v{health.version}
            </span>
          )}
        </div>

        {healthError ? (
          <p className="text-sm" style={{ color: "var(--loss)" }}>
            API unreachable
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div
              className="rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: "var(--bg-input)" }}
            >
              <StatusDot ok={health?.db === "ok"} />
              <div>
                <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  Database
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {health?.db ?? "—"}
                </div>
              </div>
            </div>

            <div
              className="rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: "var(--bg-input)" }}
            >
              <StatusDot ok={health?.redis === "ok"} />
              <div>
                <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  Redis
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {health?.redis ?? "—"}
                </div>
              </div>
            </div>

            {health?.uptime != null && (
              <div
                className="rounded-lg px-3 py-2 flex items-center gap-2"
                style={{ background: "var(--bg-input)" }}
              >
                <StatusDot ok={true} />
                <div>
                  <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    Uptime
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatUptime(health.uptime)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Data Freshness */}
      <SectionCard title="Data Freshness">
        {latestCandle ? (
          <div className="flex items-center gap-3">
            <StatusDot ok={true} />
            <div>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                BTC/USDT 1h
              </span>
              <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                latest candle {formatRelative(latestCandle.time)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <StatusDot ok={false} />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              No market data
            </span>
          </div>
        )}
      </SectionCard>

      {/* Bot Summary */}
      <SectionCard title="Bot Summary">
        {summary ? (
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-lg px-3 py-2 text-center"
              style={{ background: "var(--bg-input)" }}
            >
              <div
                className="text-lg font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {summary.botCount}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Total bots
              </div>
            </div>
            <div
              className="rounded-lg px-3 py-2 text-center"
              style={{ background: "var(--bg-input)" }}
            >
              <div
                className="text-lg font-semibold tabular-nums"
                style={{ color: summary.runningBots > 0 ? "var(--profit)" : "var(--text-muted)" }}
              >
                {summary.runningBots}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Running
              </div>
            </div>
            <div
              className="rounded-lg px-3 py-2 text-center"
              style={{ background: "var(--bg-input)" }}
            >
              <div
                className="text-lg font-semibold tabular-nums"
                style={{ color: summary.totalPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
              >
                {formatCurrency(summary.totalPnl)}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Total P&amp;L
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </div>
        )}
      </SectionCard>

      {/* Last Trades */}
      <SectionCard title="Last Trades">
        {!recentTrades || recentTrades.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 py-6 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <Activity size={20} />
            <span>No trades yet</span>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ background: "var(--bg-input)" }}
              >
                <div className="flex items-center gap-2">
                  <StatusDot ok={trade.side === "buy"} />
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
                </div>
                <div className="text-right">
                  <div className="text-xs tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(trade.price)}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatRelative(trade.executedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
