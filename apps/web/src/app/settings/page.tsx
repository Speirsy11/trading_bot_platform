"use client";

import Link from "next/link";

import {
  useFormatPreferences,
  type DecimalPlaces,
  type DisplayCurrency,
} from "@/stores/formatPreferences";
import { useUiStore } from "@/stores/ui";

export default function SettingsPage() {
  const defaultExchange = useUiStore((s) => s.defaultExchange);
  const defaultSymbol = useUiStore((s) => s.defaultSymbol);
  const setDefaultExchange = useUiStore((s) => s.setDefaultExchange);
  const setDefaultSymbol = useUiStore((s) => s.setDefaultSymbol);

  const currency = useFormatPreferences((s) => s.currency);
  const decimalPlaces = useFormatPreferences((s) => s.decimalPlaces);
  const timezone = useFormatPreferences((s) => s.timezone);
  const setCurrency = useFormatPreferences((s) => s.setCurrency);
  const setDecimalPlaces = useFormatPreferences((s) => s.setDecimalPlaces);
  const setTimezone = useFormatPreferences((s) => s.setTimezone);

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
      {/* Display Preferences */}
      <div className="glass-panel p-6 space-y-4">
        <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Display Preferences
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label
              htmlFor="settings-currency"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Base Currency
            </label>
            <select
              id="settings-currency"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
            >
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="BTC">BTC — Bitcoin</option>
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="settings-decimal-places"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Decimal Places
            </label>
            <select
              id="settings-decimal-places"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              value={decimalPlaces}
              onChange={(e) => setDecimalPlaces(Number(e.target.value) as DecimalPlaces)}
            >
              <option value={2}>2 decimal places</option>
              <option value={4}>4 decimal places</option>
              <option value={6}>6 decimal places</option>
              <option value={8}>8 decimal places</option>
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="settings-timezone"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Timezone
            </label>
            <select
              id="settings-timezone"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Europe/Berlin">Europe/Berlin</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
              <option value="Asia/Shanghai">Asia/Shanghai</option>
              <option value="Asia/Singapore">Asia/Singapore</option>
              <option value="Australia/Sydney">Australia/Sydney</option>
            </select>
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Affects currency display in backtest results and bot metrics.
        </p>
      </div>
    </div>
  );
}
