"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart2, Bot, Database, GitCompare, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { toast } from "@/components/ui/Toaster";
import { formatCurrency, formatPercent, pnlColor } from "@/lib/format";
import {
  coerceStrategyParamInput,
  formatStrategyParamLabel,
  getDefaultStrategyParams,
  isNumberStrategyParam,
  mergeStrategyParamValue,
  type StrategyParamDefinition,
} from "@/lib/strategyParams";
import { trpc } from "@/lib/trpc";

const backtestSchema = z
  .object({
    name: z.string().min(1).max(120),
    strategy: z.string().min(1),
    strategyParams: z.record(z.unknown()),
    exchange: z.string().min(1),
    symbol: z.string().min(3),
    timeframe: z.string().min(1),
    sourceResearch: z.string().uuid().optional(),
    startTime: z.number().int().positive(),
    endTime: z.number().int().positive(),
    initialBalance: z.number().positive(),
    riskConfig: z.object({
      maxPositionSizePercent: z.number(),
      maxDrawdownPercent: z.number(),
      riskPerTradePercent: z.number(),
      maxConcurrentPositions: z.number(),
      maxDailyLossPercent: z.number(),
      trailingStopEnabled: z.boolean(),
      trailingStopPercent: z.number(),
    }),
    fees: z.object({ maker: z.number().nonnegative(), taker: z.number().nonnegative() }),
    slippage: z.object({ enabled: z.boolean(), percentage: z.number().nonnegative() }),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after the start time",
    path: ["endTime"],
  });

type BacktestFormData = z.infer<typeof backtestSchema>;

const defaultRisk = {
  maxPositionSizePercent: 10,
  maxDrawdownPercent: 20,
  riskPerTradePercent: 2,
  maxConcurrentPositions: 5,
  maxDailyLossPercent: 5,
  trailingStopEnabled: false,
  trailingStopPercent: 5,
};

function parseJsonParam<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function parseOptionalNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default function BacktestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const strategies = trpc.strategies.catalog.useQuery();
  const drafts = trpc.strategies.listDrafts.useQuery({});
  const {
    data: backtests,
    isError: isBacktestsError,
    refetch: refetchBacktests,
  } = trpc.backtest.list.useQuery({ limit: 20 });
  const compareQuery = trpc.backtest.compare.useQuery(
    { backtestIds: compareIds },
    { enabled: compareIds.length >= 2, staleTime: 30_000 }
  );

  const initialStrategy = searchParams.get("strategy") ?? "sma-crossover";
  const initialStrategyParams = parseJsonParam<Record<string, unknown>>(
    searchParams.get("strategyParams")
  );
  const sourceResearch = searchParams.get("sourceResearch");
  const now = Date.now();
  const initialStartTime = parseOptionalNumber(searchParams.get("startTime"));
  const initialEndTime = parseOptionalNumber(searchParams.get("endTime"));
  const form = useForm<BacktestFormData>({
    resolver: zodResolver(backtestSchema),
    defaultValues: {
      name: searchParams.get("name") ?? `${initialStrategy} research run`,
      strategy: initialStrategy,
      strategyParams: initialStrategyParams ?? {},
      exchange: searchParams.get("exchange") ?? "binance",
      symbol: searchParams.get("symbol") ?? "BTC/USDT",
      timeframe: searchParams.get("timeframe") ?? "1h",
      sourceResearch: sourceResearch ?? undefined,
      startTime: initialStartTime ?? now - 180 * 24 * 60 * 60 * 1000,
      endTime: initialEndTime ?? now,
      initialBalance: parseOptionalNumber(searchParams.get("initialBalance")) ?? 10000,
      riskConfig: defaultRisk,
      fees: {
        maker: parseOptionalNumber(searchParams.get("makerFee")) ?? 0.001,
        taker: parseOptionalNumber(searchParams.get("takerFee")) ?? 0.001,
      },
      slippage: {
        enabled: true,
        percentage: parseOptionalNumber(searchParams.get("slippagePct")) ?? 0.0005,
      },
    },
  });

  const selectedStrategyKey = form.watch("strategy");
  const exchange = form.watch("exchange");
  const symbol = form.watch("symbol");
  const timeframe = form.watch("timeframe");
  const selectedStrategy = useMemo(
    () => strategies.data?.strategies.find((strategy) => strategy.key === selectedStrategyKey),
    [selectedStrategyKey, strategies.data?.strategies]
  );
  const strategyParams = form.watch("strategyParams") ?? {};
  const compareSeries = useMemo(
    () => buildCompareSeries(compareQuery.data ?? []),
    [compareQuery.data]
  );

  const coverage = trpc.market.getDataCoverage.useQuery(
    { exchange, symbol, timeframe },
    { enabled: exchange.length > 0 && symbol.length > 0 && timeframe.length > 0 }
  );

  useEffect(() => {
    if (!selectedStrategy) return;
    const defaults = getDefaultStrategyParams(selectedStrategy.params);
    if (!initialStrategyParams) form.setValue("strategyParams", defaults);
    if (!form.getValues("name")) form.setValue("name", `${selectedStrategy.name} research run`);
  }, [form, initialStrategyParams, selectedStrategy]);

  const setStrategyParam = (name: string, value: unknown) => {
    form.setValue(
      "strategyParams",
      mergeStrategyParamValue(form.getValues("strategyParams"), name, value),
      {
        shouldDirty: true,
        shouldValidate: true,
      }
    );
  };

  const validateConfig = trpc.strategies.validateBacktestConfig.useMutation();
  const runBacktest = trpc.backtest.run.useMutation({
    onSuccess: (data) => router.push(`/backtest/${data.backtestId}`),
    onError: (error) => toast.error(`Failed to run backtest: ${error.message}`),
  });

  const loadDraft = (draftId: string) => {
    const draft = drafts.data?.find((item) => item.id === draftId);
    if (!draft) return;

    form.setValue("name", `${draft.name} backtest`, { shouldValidate: true });
    form.setValue("strategy", draft.strategy, { shouldValidate: true });
    form.setValue("strategyParams", (draft.strategyParams as Record<string, unknown>) ?? {});
    form.setValue("riskConfig", draft.riskConfig as BacktestFormData["riskConfig"], {
      shouldValidate: true,
    });
    form.setValue("exchange", draft.exchange, { shouldValidate: true });
    form.setValue("symbol", draft.symbol, { shouldValidate: true });
    form.setValue("timeframe", draft.timeframe, { shouldValidate: true });
    toast.info("Strategy draft loaded into backtest");
  };

  const onSubmit = async (data: BacktestFormData) => {
    const validation = await validateConfig.mutateAsync(data);
    validation.warnings.forEach((warning) => toast.info(warning));
    runBacktest.mutate(data);
  };

  const toggleCompareId = (backtestId: string) => {
    setCompareIds((current) => {
      if (current.includes(backtestId)) return current.filter((id) => id !== backtestId);
      if (current.length >= 4) {
        toast.info("Compare up to 4 backtests at once");
        return current;
      }
      return [...current, backtestId];
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
            Backtest laboratory
          </p>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            Prove a strategy before it becomes a bot
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
            Run the same strategy configuration the live runner uses against collected market
            candles, with explicit fees, slippage and risk settings.
          </p>
        </div>
        <Link
          href="/strategies"
          className="rounded-xl px-4 py-2 text-sm"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        >
          Strategy workbench
        </Link>
      </div>

      {sourceResearch && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: "var(--accent-dim)", color: "var(--text-primary)" }}
        >
          Prefilled from research result {sourceResearch.slice(0, 8)} with the same strategy
          parameters, timeframe, starting balance, fees and slippage. Run the symbol-level backtest
          before promoting to paper mode.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={Database}
          title="Collected OHLCV data"
          text={
            coverage.data?.earliest
              ? `${new Date(coverage.data.earliest).toLocaleDateString()} → ${new Date(coverage.data.latest ?? Date.now()).toLocaleDateString()}`
              : "Coverage loads from the market data service."
          }
        />
        <InfoCard
          icon={ShieldCheck}
          title="Realistic execution"
          text="Fees, slippage, position sizing, drawdown and daily-loss constraints are part of the run config."
        />
        <InfoCard
          icon={Bot}
          title="Promote to paper/live"
          text="Keep the same strategy key and parameters when moving from research to bot execution."
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr),minmax(360px,0.8fr)]">
        <form
          onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
          className="glass-panel space-y-5 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
              New backtest
            </h2>
            {coverage.data && (
              <span
                className="rounded-full px-3 py-1 text-xs"
                style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
              >
                {coverage.data.completeness.toFixed(1)}% coverage
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Saved draft">
              <Select
                defaultValue=""
                onChange={(event) => {
                  loadDraft(event.target.value);
                  event.currentTarget.value = "";
                }}
              >
                <option value="">Load a saved draft…</option>
                {(drafts.data ?? []).map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {draft.name} · {draft.symbol} · {draft.timeframe}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name">
              <Input {...form.register("name")} placeholder="BTC trend test" />
            </Field>
            <Field label="Strategy">
              <Select
                value={selectedStrategyKey}
                onChange={(event) =>
                  form.setValue("strategy", event.target.value, { shouldValidate: true })
                }
              >
                {(strategies.data?.strategies ?? []).map((strategy) => (
                  <option key={strategy.key} value={strategy.key}>
                    {strategy.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
          >
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {selectedStrategy?.name ?? "Strategy parameters"}
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {selectedStrategy?.description ?? "Select a catalog strategy to edit its parameters."}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(selectedStrategy?.params ?? []).map((param) => (
                <StrategyParamField
                  key={param.name}
                  param={param}
                  value={strategyParams[param.name] ?? param.defaultValue ?? ""}
                  onChange={(value) => setStrategyParam(param.name, value)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Exchange">
              <Select {...form.register("exchange")}>
                <option value="binance">Binance</option>
                <option value="kraken">Kraken</option>
                <option value="kucoin">KuCoin</option>
              </Select>
            </Field>
            <Field label="Symbol">
              <Input {...form.register("symbol")} placeholder="BTC/USDT" />
            </Field>
            <Field label="Timeframe">
              <Select {...form.register("timeframe")}>
                {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Start">
              <Input
                type="date"
                value={toDateInput(form.watch("startTime"))}
                onChange={(event) =>
                  form.setValue(
                    "startTime",
                    new Date(`${event.target.value}T00:00:00Z`).getTime(),
                    { shouldValidate: true }
                  )
                }
              />
            </Field>
            <Field label="End">
              <Input
                type="date"
                value={toDateInput(form.watch("endTime"))}
                onChange={(event) =>
                  form.setValue("endTime", new Date(`${event.target.value}T23:59:59Z`).getTime(), {
                    shouldValidate: true,
                  })
                }
              />
            </Field>
            <Field label="Initial balance">
              <Input type="number" {...form.register("initialBalance", { valueAsNumber: true })} />
            </Field>
            <Field label="Risk per trade %">
              <Input
                type="number"
                step="0.1"
                {...form.register("riskConfig.riskPerTradePercent", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Max position %">
              <Input
                type="number"
                step="1"
                {...form.register("riskConfig.maxPositionSizePercent", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Max daily loss %">
              <Input
                type="number"
                step="1"
                {...form.register("riskConfig.maxDailyLossPercent", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Maker fee">
              <Input
                type="number"
                step="0.0001"
                {...form.register("fees.maker", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Taker fee">
              <Input
                type="number"
                step="0.0001"
                {...form.register("fees.taker", { valueAsNumber: true })}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={runBacktest.isPending || validateConfig.isPending}
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
          >
            {runBacktest.isPending || validateConfig.isPending ? "Queueing…" : "Run backtest"}
          </button>
        </form>

        <div className="glass-panel p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
                Backtest history
              </h2>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Select 2-4 completed runs to compare normalized return curves.
              </p>
            </div>
            {compareIds.length > 0 && (
              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Clear compare
              </button>
            )}
          </div>

          {compareIds.length > 0 && (
            <div
              className="mb-4 rounded-xl p-3"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  <GitCompare size={15} style={{ color: "var(--accent)" }} />
                  {compareIds.length < 2
                    ? "Pick one more completed run"
                    : `${compareIds.length} runs selected`}
                </div>
                {compareQuery.isFetching && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Loading…
                  </span>
                )}
              </div>

              {compareQuery.isError && (
                <p className="mt-3 text-xs" style={{ color: "var(--loss)" }}>
                  {compareQuery.error.message}
                </p>
              )}

              {compareSeries.length >= 2 && (
                <div className="mt-3 space-y-3">
                  <PerformanceChart
                    data={compareSeries[0]?.data ?? []}
                    comparisonData={compareSeries[1]?.data}
                    extraSeries={compareSeries.slice(2)}
                    height={220}
                    color={compareSeries[0]?.color}
                    comparisonColor={compareSeries[1]?.color}
                    seriesName={compareSeries[0]?.name ?? "Run 1"}
                    comparisonName={compareSeries[1]?.name ?? "Run 2"}
                  />
                  <div className="space-y-2">
                    {compareSeries.map((series) => (
                      <div
                        key={series.id}
                        className="grid grid-cols-[1fr,auto] items-center gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: series.color }}
                            />
                            <span
                              className="truncate"
                              style={{ color: "var(--text-secondary)" }}
                              title={series.name}
                            >
                              {series.name}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                            {formatCurrency(series.finalBalance)} final equity
                            {series.benchmarkReturn !== null && (
                              <> · bench {formatPercent(series.benchmarkReturn)}</>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className="tabular-nums"
                            style={{ color: pnlColor(series.totalReturn) }}
                          >
                            {formatPercent(series.totalReturn)}
                          </div>
                          <div
                            className="tabular-nums"
                            style={{
                              color:
                                series.excessReturn === null
                                  ? "var(--text-muted)"
                                  : pnlColor(series.excessReturn),
                            }}
                          >
                            {series.excessReturn === null
                              ? "excess n/a"
                              : `${formatPercent(series.excessReturn)} excess`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isBacktestsError ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-sm" style={{ color: "var(--loss)" }}>
                Failed to load data
              </p>
              <button
                onClick={() => void refetchBacktests()}
                className="rounded-lg px-3 py-1.5 text-xs"
                style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
              >
                Retry
              </button>
            </div>
          ) : !backtests || backtests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart2
                size={48}
                style={{ color: "var(--text-muted)", opacity: 0.4 }}
                className="mb-4"
              />
              <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                No backtests yet
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                Run your first backtest using the form.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backtests.map((bt) => (
                <div
                  key={bt.id}
                  className="rounded-lg p-3 transition-colors"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCompareId(bt.id)}
                      disabled={bt.status !== "completed"}
                      aria-pressed={compareIds.includes(bt.id)}
                      aria-label={`Compare ${bt.name}`}
                      title={
                        bt.status === "completed"
                          ? "Add to comparison"
                          : "Only completed backtests can be compared"
                      }
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: compareIds.includes(bt.id)
                          ? "var(--accent)"
                          : "rgba(255,255,255,0.03)",
                        color: compareIds.includes(bt.id)
                          ? "var(--primary-foreground)"
                          : "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <GitCompare size={14} />
                    </button>
                    <Link href={`/backtest/${bt.id}`} className="min-w-0 flex-1">
                      <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {bt.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {bt.strategy} · {bt.symbol}
                      </div>
                    </Link>
                    <div
                      className="text-right text-xs tabular-nums"
                      style={{
                        color:
                          bt.status === "completed"
                            ? pnlColor(bt.totalPnlPercent)
                            : "var(--text-muted)",
                      }}
                    >
                      <div>{bt.status}</div>
                      {bt.status === "completed" && <div>{formatPercent(bt.totalPnlPercent)}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Database;
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
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
  const fieldId = `backtest-param-${param.name}`;
  const fieldValue = value === null || value === undefined ? "" : String(value);

  return (
    <Field label={formatStrategyParamLabel(param.name)}>
      <div className="space-y-1.5">
        {param.inputType === "select" ? (
          <Select
            id={fieldId}
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
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
          >
            <input
              id={fieldId}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span>Enabled</span>
          </div>
        ) : isNumberStrategyParam(param, value) ? (
          <Input
            id={fieldId}
            type="number"
            min={param.min ?? undefined}
            max={param.max ?? undefined}
            step={param.integer ? 1 : "any"}
            value={fieldValue}
            onChange={(event) => onChange(coerceStrategyParamInput(param, event.target.value))}
          />
        ) : (
          <Input
            id={fieldId}
            value={fieldValue}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        {param.description && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {param.description}
          </p>
        )}
      </div>
    </Field>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
      style={{
        background: "var(--bg-input)",
        color: "var(--text-primary)",
        border: "1px solid var(--border)",
        ...props.style,
      }}
    />
  );
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
      style={{
        background: "var(--bg-input)",
        color: "var(--text-primary)",
        border: "1px solid var(--border)",
        ...props.style,
      }}
    />
  );
}

function toDateInput(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

type CompareRun = {
  backtestId: string;
  name: string;
  strategy: string;
  symbol: string;
  timeframe?: string;
  initialBalance: number;
  finalBalance: number;
  totalReturn?: number;
  maxDrawdown?: number;
  profitFactor?: number;
  benchmarkReturn?: number | null;
  excessReturn?: number | null;
  equityCurve: Array<{ t: string; balance: number }>;
};

const COMPARE_COLORS = ["#c8a55a", "#5ab8c8", "#6ee7a0", "#f87171"];

function buildCompareSeries(runs: CompareRun[]) {
  return runs.map((run, index) => {
    const firstBalance = run.equityCurve[0]?.balance;
    const initialBalance =
      Number.isFinite(run.initialBalance) && run.initialBalance > 0
        ? run.initialBalance
        : Number(firstBalance) > 0
          ? Number(firstBalance)
          : 1;
    const color = COMPARE_COLORS[index % COMPARE_COLORS.length] ?? COMPARE_COLORS[0]!;
    const data = run.equityCurve
      .map((point) => ({
        time: Date.parse(point.t),
        value: ((Number(point.balance) - initialBalance) / initialBalance) * 100,
      }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value));
    const finalBalance = Number.isFinite(run.finalBalance)
      ? run.finalBalance
      : (run.equityCurve.at(-1)?.balance ?? initialBalance);
    const totalReturn = Number.isFinite(run.totalReturn)
      ? Number(run.totalReturn)
      : ((finalBalance - initialBalance) / initialBalance) * 100;
    const benchmarkReturn =
      typeof run.benchmarkReturn === "number" && Number.isFinite(run.benchmarkReturn)
        ? run.benchmarkReturn
        : null;
    const excessReturn =
      typeof run.excessReturn === "number" && Number.isFinite(run.excessReturn)
        ? run.excessReturn
        : benchmarkReturn === null
          ? null
          : totalReturn - benchmarkReturn;

    return {
      id: run.backtestId,
      name: `${run.name} · ${run.symbol}${run.timeframe ? ` · ${run.timeframe}` : ""}`,
      color,
      finalBalance,
      totalReturn,
      benchmarkReturn,
      excessReturn,
      maxDrawdown:
        typeof run.maxDrawdown === "number" && Number.isFinite(run.maxDrawdown)
          ? run.maxDrawdown
          : null,
      profitFactor:
        typeof run.profitFactor === "number" && Number.isFinite(run.profitFactor)
          ? run.profitFactor
          : null,
      data,
    };
  });
}
