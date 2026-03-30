"use client";

import Link from "next/link";

import { useUiStore } from "@/stores/ui";

export default function SettingsPage() {
  const defaultExchange = useUiStore((s) => s.defaultExchange);
  const defaultSymbol = useUiStore((s) => s.defaultSymbol);
  const setDefaultExchange = useUiStore((s) => s.setDefaultExchange);
  const setDefaultSymbol = useUiStore((s) => s.setDefaultSymbol);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
        Settings
      </h1>

      {/* Exchange Connections */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Exchange Connections
          </h2>
          <Link
            href="/settings/exchanges"
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
          >
            Manage Exchanges
          </Link>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Connect your exchange API keys to enable live trading and data.
        </p>
      </div>

      {/* Defaults */}
      <div className="glass-panel p-6 space-y-4">
        <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Defaults
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label
              htmlFor="settings-default-exchange"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Default Exchange
            </label>
            <select
              id="settings-default-exchange"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              value={defaultExchange}
              onChange={(e) => setDefaultExchange(e.target.value)}
            >
              <option value="binance">Binance</option>
              <option value="bybit">Bybit</option>
              <option value="kraken">Kraken</option>
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="settings-default-symbol"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Default Symbol
            </label>
            <input
              id="settings-default-symbol"
              type="text"
              value={defaultSymbol}
              onChange={(e) => setDefaultSymbol(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
