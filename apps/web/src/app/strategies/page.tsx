"use client";

import { Bot, FlaskConical, PlayCircle, ShieldCheck, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { trpc } from "@/lib/trpc";

const DEFAULT_SYMBOL = "BTC/USDT";
const DEFAULT_EXCHANGE = "binance";

export default function StrategiesPage() {
  const { data, isLoading } = trpc.strategies.catalog.useQuery();
  const [selectedStrategy, setSelectedStrategy] = useState("sma-crossover");
  const selected = useMemo(
    () => data?.strategies.find((strategy) => strategy.key === selectedStrategy),
    [data?.strategies, selectedStrategy]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
            Strategy workbench
          </p>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            Create, test, then deploy trading strategies
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
            The platform is now centred on the strategy lifecycle: edit parameters, backtest on
            collected OHLCV candles, then run the same configuration in paper or live crypto mode.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/backtest"
            className="rounded-xl px-4 py-2 text-sm"
            style={{ background: "var(--accent)", color: "#08080a" }}
          >
            Run backtest
          </Link>
          <Link
            href="/bots/new"
            className="rounded-xl px-4 py-2 text-sm"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            Create live/paper bot
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Capability
          icon={SlidersHorizontal}
          title="Strategy editor"
          text="Parameter schemas, templates, risk presets, and draft-safe bot creation."
        />
        <Capability
          icon={FlaskConical}
          title="Backtest first"
          text="Run configs against collected candles before trusting them with capital."
        />
        <Capability
          icon={PlayCircle}
          title="Paper/live launch"
          text="Promote a proven setup to a paper runner, then live exchange execution when ready."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
        <div className="glass-panel p-4">
          <h2 className="mb-3 text-lg" style={{ color: "var(--text-primary)" }}>
            Strategy catalog
          </h2>
          <div className="space-y-2">
            {(data?.strategies ?? []).map((strategy) => (
              <button
                key={strategy.key}
                onClick={() => setSelectedStrategy(strategy.key)}
                className="w-full rounded-xl p-3 text-left transition-colors"
                style={{
                  background:
                    selectedStrategy === strategy.key ? "var(--accent-dim)" : "var(--bg-input)",
                  border: `1px solid ${selectedStrategy === strategy.key ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {strategy.name}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {strategy.description}
                </div>
              </button>
            ))}
            {isLoading && (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Loading strategies…
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl" style={{ color: "var(--text-primary)" }}>
                  {selected?.name ?? "Select a strategy"}
                </h2>
                <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  {selected?.description ??
                    "Choose a strategy from the catalog to inspect editable parameters."}
                </p>
              </div>
              <ShieldCheck size={28} style={{ color: "var(--accent)" }} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {(selected?.params ?? []).map((param) => (
                <div
                  key={param.name}
                  className="rounded-xl p-3"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
                >
                  <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {param.name}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    {String(param.type).replace("Zod", "")} · default{" "}
                    {param.defaultValue == null ? "—" : String(param.defaultValue)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/backtest?strategy=${selectedStrategy}&symbol=${encodeURIComponent(DEFAULT_SYMBOL)}&exchange=${DEFAULT_EXCHANGE}`}
                className="rounded-xl px-4 py-2 text-sm"
                style={{ background: "var(--accent)", color: "#08080a" }}
              >
                Backtest this strategy
              </Link>
              <Link
                href={`/bots/new?strategy=${selectedStrategy}`}
                className="rounded-xl px-4 py-2 text-sm"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                Create bot from strategy
              </Link>
            </div>
          </div>

          <div className="glass-panel p-5">
            <h2 className="mb-3 text-lg" style={{ color: "var(--text-primary)" }}>
              Launch-ready presets
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {(data?.presets ?? []).map((preset) => (
                <div
                  key={preset.id}
                  className="rounded-xl p-4"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="flex items-center gap-2 text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <Bot size={16} /> {preset.name}
                  </div>
                  <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    {preset.description}
                  </p>
                  <div className="mt-3 text-xs" style={{ color: "var(--accent)" }}>
                    {preset.recommendedTimeframes.join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Capability({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof SlidersHorizontal;
  title: string;
  text: string;
}) {
  return (
    <div className="glass-panel p-4">
      <Icon size={22} style={{ color: "var(--accent)" }} />
      <h2 className="mt-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {text}
      </p>
    </div>
  );
}
