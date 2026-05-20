"use client";

import Link from "next/link";
import { useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { useMarketData } from "@/hooks/useMarketData";
import { useTicker } from "@/hooks/useTicker";
import { formatCurrency, formatNumber, pnlColor } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useUiStore } from "@/stores/ui";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

export default function TradingPage() {
  const selectedSymbol = useUiStore((s) => s.selectedSymbol);
  const selectedExchange = useUiStore((s) => s.selectedExchange);
  const [timeframe, setTimeframe] = useState("1h");
  const { data: ticker } = useTicker(selectedExchange, selectedSymbol);
  const { data: candles } = useMarketData(selectedExchange, selectedSymbol, timeframe);
  const { data: bots } = trpc.bots.list.useQuery({ status: "all", exchange: selectedExchange });
  const lastPrice = ticker?.last ?? candles?.[candles.length - 1]?.close ?? 0;
  const change24h = ticker?.change24h;
  const volume24h = ticker?.volume ?? 0;
  const symbolBots = (bots ?? []).filter((bot) => bot.symbol === selectedSymbol);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
            {selectedSymbol}
          </h1>
          {(ticker || lastPrice > 0) && (
            <div className="flex items-center gap-4 text-sm">
              <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(lastPrice)}
              </span>
              <span className="tabular-nums" style={{ color: pnlColor(change24h ?? 0) }}>
                {change24h !== undefined ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%` : "—"}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Vol {formatNumber(volume24h, 0)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="rounded-lg px-3 py-1 text-xs transition-colors"
              style={{
                color: tf === timeframe ? "var(--accent)" : "var(--text-muted)",
                background: tf === timeframe ? "var(--accent-dim)" : "transparent",
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <ErrorBoundary>
            <div className="glass-panel p-4">
              <CandlestickChart data={candles ?? []} height={500} />
            </div>
          </ErrorBoundary>
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-4">
            <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Algorithm launchpad
            </h3>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Manual single-order entry has been removed from the primary workflow. Use strategies, backtests, and controlled bot runs instead.
            </p>
            <div className="mt-4 grid gap-2">
              <Link href={`/backtest?symbol=${encodeURIComponent(selectedSymbol)}&exchange=${selectedExchange}`} className="rounded-xl px-3 py-2 text-center text-sm" style={{ background: "var(--accent)", color: "#08080a" }}>
                Backtest on this market
              </Link>
              <Link href="/bots/new" className="rounded-xl px-3 py-2 text-center text-sm" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                Create paper/live bot
              </Link>
              <Link href="/strategies" className="rounded-xl px-3 py-2 text-center text-sm" style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                Edit strategies
              </Link>
            </div>
          </div>

          <div className="glass-panel p-4">
            <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Runs on {selectedSymbol}
            </h3>
            <div className="mt-3 space-y-2">
              {symbolBots.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No paper or live bots are attached to this market yet.
                </p>
              ) : (
                symbolBots.map((bot) => (
                  <Link key={bot.id} href={`/bots/${bot.id}`} className="block rounded-xl p-3" style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}>
                    <div className="text-sm" style={{ color: "var(--text-primary)" }}>{bot.name}</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {bot.strategy} · {bot.mode} · {bot.status}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="glass-panel p-4">
            <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Live safety model
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs" style={{ color: "var(--text-muted)" }}>
              <li>Paper mode uses the same strategy/runtime path without real orders.</li>
              <li>Live mode requires exchange credentials and existing kill-switch/risk checks.</li>
              <li>Every run links back to a strategy config and backtest workflow.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
