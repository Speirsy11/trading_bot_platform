"use client";

import Link from "next/link";
import { useState } from "react";

import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { trpc } from "@/lib/trpc";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

export default function MarketDataPage() {
  const [exchange, setExchange] = useState("binance");
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1h");
  const [previewSymbol, setPreviewSymbol] = useState("");

  const { data: symbols } = trpc.market.getSymbols.useQuery({ exchange }, { enabled: !!exchange });

  const { data: candles } = trpc.market.getCandles.useQuery(
    { exchange, symbol: previewSymbol, timeframe },
    { enabled: !!previewSymbol }
  );

  const filteredSymbols = symbols?.filter(
    (s: string) => !symbol || s.toLowerCase().includes(symbol.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
          Market Data
        </h1>
        <Link
          href="/market-data/export"
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
        >
          Export Data
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Exchange
            </label>
            <select
              value={exchange}
              onChange={(e) => {
                setExchange(e.target.value);
                setPreviewSymbol("");
              }}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <option value="binance">Binance</option>
              <option value="bybit">Bybit</option>
              <option value="kraken">Kraken</option>
            </select>
          </div>

          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Search Symbol
            </label>
            <input
              type="text"
              placeholder="e.g. BTC/USDT"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Timeframe
            </label>
            <div className="flex gap-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className="px-3 py-2 text-xs rounded-lg transition-colors"
                  style={{
                    color: tf === timeframe ? "var(--accent)" : "var(--text-muted)",
                    background: tf === timeframe ? "var(--accent-dim)" : "var(--bg-input)",
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Symbol List */}
        <div className="glass-panel p-4 max-h-[600px] overflow-y-auto">
          <h3
            className="text-xs font-medium mb-3 sticky top-0 pb-2"
            style={{ color: "var(--text-muted)", background: "var(--bg-card)" }}
          >
            Symbols ({filteredSymbols?.length ?? 0})
          </h3>
          <div className="space-y-1">
            {filteredSymbols?.map((s: string) => (
              <button
                key={s}
                onClick={() => setPreviewSymbol(s)}
                className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: previewSymbol === s ? "var(--accent-dim)" : "transparent",
                  color: previewSymbol === s ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                <span>{s}</span>
              </button>
            ))}
            {filteredSymbols?.length === 0 && (
              <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
                No symbols found
              </p>
            )}
          </div>
        </div>

        {/* Preview Chart */}
        <div className="lg:col-span-2 glass-panel p-4">
          {previewSymbol ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {previewSymbol} — {timeframe}
                </h3>
                {candles && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {candles.length} candles loaded
                  </span>
                )}
              </div>
              <CandlestickChart data={candles ?? []} height={450} />
            </>
          ) : (
            <div
              className="flex items-center justify-center h-[450px] text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Select a symbol to preview chart data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
