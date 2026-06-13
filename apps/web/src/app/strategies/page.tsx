"use client";

import {
  Bot,
  FlaskConical,
  PlayCircle,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { toast } from "@/components/ui/Toaster";
import {
  coerceStrategyParamInput,
  formatStrategyParamLabel,
  formatStrategyParamType,
  getDefaultStrategyParams,
  isNumberStrategyParam,
  mergeStrategyParamValue,
  type StrategyParamDefinition,
  type StrategyParams,
} from "@/lib/strategyParams";
import { trpc } from "@/lib/trpc";

const DEFAULT_SYMBOL = "BTC/USDT";
const DEFAULT_EXCHANGE = "binance";
const DEFAULT_TIMEFRAME = "1h";
const DEFAULT_RISK_CONFIG = {
  maxPositionSizePercent: 10,
  maxDrawdownPercent: 20,
  riskPerTradePercent: 2,
  maxConcurrentPositions: 5,
  maxDailyLossPercent: 5,
  trailingStopEnabled: false,
  trailingStopPercent: 5,
};

export default function StrategiesPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.strategies.catalog.useQuery();
  const drafts = trpc.strategies.listDrafts.useQuery({});
  const createDraft = trpc.strategies.createDraft.useMutation({
    onSuccess: async () => {
      await utils.strategies.listDrafts.invalidate();
      toast.success("Strategy draft saved");
    },
    onError: (error) => toast.error(`Failed to save draft: ${error.message}`),
  });
  const deleteDraft = trpc.strategies.deleteDraft.useMutation({
    onSuccess: async () => {
      await utils.strategies.listDrafts.invalidate();
      toast.success("Strategy draft deleted");
    },
    onError: (error) => toast.error(`Failed to delete draft: ${error.message}`),
  });

  const [selectedStrategy, setSelectedStrategy] = useState("sma-crossover");
  const [draftName, setDraftName] = useState("");
  const [exchange, setExchange] = useState(DEFAULT_EXCHANGE);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [notes, setNotes] = useState("");
  const [strategyParams, setStrategyParams] = useState<StrategyParams>({});
  const [initializedStrategy, setInitializedStrategy] = useState<string | null>(null);

  const selected = useMemo(
    () => data?.strategies.find((strategy) => strategy.key === selectedStrategy),
    [data?.strategies, selectedStrategy]
  );

  useEffect(() => {
    if (!selected || initializedStrategy === selected.key) return;
    const defaults = getDefaultStrategyParams(selected.params);
    setStrategyParams(defaults);
    setDraftName(`${selected.name} draft`);
    setInitializedStrategy(selected.key);
  }, [initializedStrategy, selected]);

  const selectCatalogStrategy = (strategy: NonNullable<typeof data>["strategies"][number]) => {
    setSelectedStrategy(strategy.key);
    setStrategyParams(getDefaultStrategyParams(strategy.params));
    setDraftName(`${strategy.name} draft`);
    setNotes("");
    setInitializedStrategy(strategy.key);
  };

  const saveCurrentDraft = () => {
    createDraft.mutate({
      name: draftName.trim() || `${selected?.name ?? selectedStrategy} draft`,
      strategy: selectedStrategy,
      strategyParams,
      riskConfig: DEFAULT_RISK_CONFIG,
      exchange,
      symbol,
      timeframe,
      notes: notes.trim() || undefined,
    });
  };

  const selectedBacktestHref = buildBacktestHref({
    strategy: selectedStrategy,
    strategyParams,
    exchange,
    symbol,
    timeframe,
  });
  const selectedBotHref = buildBotHref({
    strategy: selectedStrategy,
    strategyParams,
    exchange,
    symbol,
    timeframe,
    name: `${draftName || selected?.name || selectedStrategy} paper run`,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
            Strategy workbench
          </p>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            Create, save, test, then deploy trading strategies
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
            Save reusable strategy drafts with parameters, market defaults and notes. Backtest the
            exact draft first, then promote it into a paper bot.
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
          title="Draft editor"
          text="Tune template parameters and save named strategy drafts for reuse."
        />
        <Capability
          icon={FlaskConical}
          title="Backtest first"
          text="Launch a backtest from the exact saved draft before trusting it with capital."
        />
        <Capability
          icon={PlayCircle}
          title="Paper/live launch"
          text="Promote a proven setup to paper mode, then live exchange execution when ready."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr),360px]">
        <div className="glass-panel p-4">
          <h2 className="mb-3 text-lg" style={{ color: "var(--text-primary)" }}>
            Strategy catalog
          </h2>
          <div className="space-y-2">
            {(data?.strategies ?? []).map((strategy) => (
              <button
                key={strategy.key}
                onClick={() => selectCatalogStrategy(strategy)}
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
                <StrategyParamField
                  key={param.name}
                  param={param}
                  value={strategyParams[param.name] ?? param.defaultValue ?? ""}
                  onChange={(value) =>
                    setStrategyParams((current) =>
                      mergeStrategyParamValue(current, param.name, value)
                    )
                  }
                />
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Field label="Draft name">
                <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
              </Field>
              <Field label="Exchange">
                <Input value={exchange} onChange={(event) => setExchange(event.target.value)} />
              </Field>
              <Field label="Symbol">
                <Input value={symbol} onChange={(event) => setSymbol(event.target.value)} />
              </Field>
              <Field label="Timeframe">
                <Input value={timeframe} onChange={(event) => setTimeframe(event.target.value)} />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="Why this config exists, what to test next, or safety assumptions…"
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveCurrentDraft}
                disabled={createDraft.isPending}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-60"
                style={{ background: "var(--accent)", color: "#08080a" }}
              >
                <Save size={16} /> {createDraft.isPending ? "Saving…" : "Save draft"}
              </button>
              <Link
                href={selectedBacktestHref}
                className="rounded-xl px-4 py-2 text-sm"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                Backtest current config
              </Link>
              <Link
                href={selectedBotHref}
                className="rounded-xl px-4 py-2 text-sm"
                style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
              >
                Create paper bot
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

        <div className="glass-panel p-4">
          <h2 className="mb-3 text-lg" style={{ color: "var(--text-primary)" }}>
            Saved drafts
          </h2>
          <div className="space-y-3">
            {(drafts.data ?? []).map((draft) => {
              const draftBacktestHref = buildBacktestHref({
                strategy: draft.strategy,
                strategyParams: draft.strategyParams as StrategyParams,
                exchange: draft.exchange,
                symbol: draft.symbol,
                timeframe: draft.timeframe,
              });
              const draftBotHref = buildBotHref({
                strategy: draft.strategy,
                strategyParams: draft.strategyParams as StrategyParams,
                exchange: draft.exchange,
                symbol: draft.symbol,
                timeframe: draft.timeframe,
                name: `${draft.name} paper run`,
              });

              return (
                <div
                  key={draft.id}
                  className="rounded-xl p-4"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {draft.name}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        {draft.strategy} · {draft.symbol} · {draft.timeframe}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${draft.name}`}
                      onClick={() => deleteDraft.mutate({ draftId: draft.id })}
                      className="rounded-lg p-1.5"
                      style={{ color: "var(--loss)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {draft.notes && (
                    <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      {draft.notes}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStrategy(draft.strategy);
                        setDraftName(draft.name);
                        setExchange(draft.exchange);
                        setSymbol(draft.symbol);
                        setTimeframe(draft.timeframe);
                        setNotes(draft.notes ?? "");
                        setStrategyParams((draft.strategyParams as StrategyParams) ?? {});
                        setInitializedStrategy(draft.strategy);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                    >
                      Load
                    </button>
                    <Link
                      href={draftBacktestHref}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}
                    >
                      Backtest
                    </Link>
                    <Link
                      href={draftBotHref}
                      className="rounded-lg px-3 py-1.5 text-xs"
                      style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}
                    >
                      Paper bot
                    </Link>
                  </div>
                </div>
              );
            })}
            {drafts.isLoading && (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Loading drafts…
              </div>
            )}
            {!drafts.isLoading && (drafts.data ?? []).length === 0 && (
              <div className="rounded-xl p-4 text-sm" style={{ color: "var(--text-muted)" }}>
                No saved drafts yet. Tune a catalog strategy and save it here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyParamField({
  param,
  value,
  onChange,
}: {
  param: StrategyParamDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const fieldValue = value === null || value === undefined ? "" : String(value);

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
    >
      <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {formatStrategyParamLabel(param.name)}
      </label>
      <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {formatStrategyParamType(param)} · default{" "}
        {param.defaultValue == null ? "—" : String(param.defaultValue)}
      </div>
      {param.inputType === "select" ? (
        <Select
          className="mt-3"
          value={fieldValue}
          onChange={(event) => onChange(event.target.value)}
        >
          {(param.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      ) : param.inputType === "boolean" ? (
        <label
          className="mt-3 flex items-center gap-2 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          Enabled
        </label>
      ) : isNumberStrategyParam(param, value) ? (
        <Input
          className="mt-3"
          type="number"
          min={param.min ?? undefined}
          max={param.max ?? undefined}
          step={param.integer ? 1 : "any"}
          value={fieldValue}
          onChange={(event) => onChange(coerceStrategyParamInput(param, event.target.value))}
        />
      ) : (
        <Input
          className="mt-3"
          value={fieldValue}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {param.description && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {param.description}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl px-3 py-2 text-sm outline-none ${className}`}
      style={{
        background: "var(--bg-input)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
      {...props}
    />
  );
}

function Select({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-xl px-3 py-2 text-sm outline-none ${className}`}
      style={{
        background: "var(--bg-input)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
      {...props}
    />
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

function buildBacktestHref({
  strategy,
  strategyParams,
  exchange,
  symbol,
  timeframe,
}: {
  strategy: string;
  strategyParams: StrategyParams;
  exchange: string;
  symbol: string;
  timeframe: string;
}) {
  const params = new URLSearchParams({
    strategy,
    strategyParams: JSON.stringify(strategyParams),
    exchange,
    symbol,
    timeframe,
  });
  return `/backtest?${params.toString()}`;
}

function buildBotHref({
  strategy,
  strategyParams,
  exchange,
  symbol,
  timeframe,
  name,
}: {
  strategy: string;
  strategyParams: StrategyParams;
  exchange: string;
  symbol: string;
  timeframe: string;
  name: string;
}) {
  const params = new URLSearchParams({
    mode: "paper",
    strategy,
    strategyParams: JSON.stringify(strategyParams),
    exchange,
    symbol,
    timeframe,
    name,
  });
  return `/bots/new?${params.toString()}`;
}
