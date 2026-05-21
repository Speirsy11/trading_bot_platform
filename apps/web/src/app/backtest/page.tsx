"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart2, Bot, Database, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toast } from "@/components/ui/Toaster";
import { trpc } from "@/lib/trpc";

const backtestSchema = z
  .object({
    name: z.string().min(1).max(120),
    strategy: z.string().min(1),
    strategyParams: z.record(z.unknown()),
    exchange: z.string().min(1),
    symbol: z.string().min(3),
    timeframe: z.string().min(1),
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

export default function BacktestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const strategies = trpc.strategies.catalog.useQuery();
  const {
    data: backtests,
    isError: isBacktestsError,
    refetch: refetchBacktests,
  } = trpc.backtest.list.useQuery({ limit: 20 });

  const initialStrategy = searchParams.get("strategy") ?? "sma-crossover";
  const form = useForm<BacktestFormData>({
    resolver: zodResolver(backtestSchema),
    defaultValues: {
      name: `${initialStrategy} research run`,
      strategy: initialStrategy,
      strategyParams: {},
      exchange: searchParams.get("exchange") ?? "binance",
      symbol: searchParams.get("symbol") ?? "BTC/USDT",
      timeframe: "1h",
      startTime: Date.now() - 180 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      initialBalance: 10000,
      riskConfig: defaultRisk,
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: true, percentage: 0.0005 },
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

  const coverage = trpc.market.getDataCoverage.useQuery(
    { exchange, symbol, timeframe },
    { enabled: exchange.length > 0 && symbol.length > 0 && timeframe.length > 0 }
  );

  useEffect(() => {
    if (!selectedStrategy) return;
    const defaults = Object.fromEntries(
      selectedStrategy.params
        .map((param) => [param.name, param.defaultValue])
        .filter(([, value]) => value !== undefined)
    );
    form.setValue("strategyParams", defaults);
    if (!form.getValues("name")) form.setValue("name", `${selectedStrategy.name} research run`);
  }, [form, selectedStrategy]);

  const validateConfig = trpc.strategies.validateBacktestConfig.useMutation();
  const runBacktest = trpc.backtest.run.useMutation({
    onSuccess: (data) => router.push(`/backtest/${data.backtestId}`),
    onError: (error) => toast.error(`Failed to run backtest: ${error.message}`),
  });

  const onSubmit = async (data: BacktestFormData) => {
    const validation = await validateConfig.mutateAsync(data);
    validation.warnings.forEach((warning) => toast.info(warning));
    runBacktest.mutate(data);
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
            <Field label="Name">
              <Input {...form.register("name")} placeholder="BTC trend test" />
            </Field>
            <Field label="Strategy">
              <Select {...form.register("strategy")}>
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
                <Field key={param.name} label={param.name}>
                  <Input
                    type="number"
                    step="1"
                    defaultValue={String(param.defaultValue ?? "")}
                    onChange={(event) => {
                      const current = form.getValues("strategyParams");
                      form.setValue("strategyParams", {
                        ...current,
                        [param.name]: Number(event.target.value),
                      });
                    }}
                  />
                </Field>
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
          <h2 className="mb-4 text-lg" style={{ color: "var(--text-primary)" }}>
            Backtest history
          </h2>
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
                <Link
                  key={bt.id}
                  href={`/backtest/${bt.id}`}
                  className="block rounded-lg p-3 transition-colors"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {bt.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {bt.strategy} · {bt.symbol}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {bt.status}
                    </div>
                  </div>
                </Link>
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
