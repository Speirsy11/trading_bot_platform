"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type FieldPath, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { trpc } from "@/lib/trpc";

const botFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  strategy: z.string().min(1, "Strategy is required"),
  strategyParams: z.record(z.unknown()),
  exchange: z.string().min(1, "Exchange is required"),
  symbol: z.string().min(3, "Symbol is required"),
  timeframe: z.string().min(1),
  mode: z.enum(["backtest", "paper", "live"]),
  riskConfig: z.object({
    maxPositionSizePercent: z.number().min(1).max(100),
    maxDrawdownPercent: z.number().min(1).max(100),
    riskPerTradePercent: z.number().min(0.1).max(50),
    maxConcurrentPositions: z.number().min(1).max(50),
    maxDailyLossPercent: z.number().min(1).max(100),
    trailingStopEnabled: z.boolean(),
    trailingStopPercent: z.number().min(0.1).max(50),
  }),
  currentBalance: z.number().positive().optional(),
});

type BotFormData = z.infer<typeof botFormSchema>;

type StrategyOption = { name: string; description?: string };
type ExchangeOption = { exchange: string; name: string };

const STEPS = ["Strategy", "Parameters", "Exchange & Pair", "Risk", "Mode", "Review"];

const FALLBACK_STRATEGIES: StrategyOption[] = [
  { name: "sma_crossover" },
  { name: "rsi_mean_reversion" },
  { name: "macd_trend" },
];

const FALLBACK_EXCHANGES: ExchangeOption[] = [
  { exchange: "binance", name: "Binance" },
  { exchange: "kraken", name: "Kraken" },
  { exchange: "kucoin", name: "KuCoin" },
  { exchange: "bybit", name: "Bybit" },
  { exchange: "coinbase", name: "Coinbase" },
];

const STEP_FIELDS: Record<number, FieldPath<BotFormData>[]> = {
  0: ["name", "strategy"],
  1: ["timeframe"],
  2: ["exchange", "symbol"],
  3: [
    "riskConfig.maxPositionSizePercent",
    "riskConfig.maxDrawdownPercent",
    "riskConfig.riskPerTradePercent",
    "riskConfig.maxConcurrentPositions",
    "riskConfig.maxDailyLossPercent",
    "riskConfig.trailingStopPercent",
  ],
  4: ["mode", "currentBalance"],
};

export default function CreateBotPage() {
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();
  const strategiesQuery = trpc.market.getStrategies.useQuery();
  const exchangesQuery = trpc.exchanges.list.useQuery();

  const form = useForm<BotFormData>({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      name: "",
      strategy: "",
      strategyParams: {},
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "1h",
      mode: "paper",
      riskConfig: {
        maxPositionSizePercent: 10,
        maxDrawdownPercent: 20,
        riskPerTradePercent: 2,
        maxConcurrentPositions: 5,
        maxDailyLossPercent: 5,
        trailingStopEnabled: false,
        trailingStopPercent: 5,
      },
    },
  });

  const strategyOptions = Array.from(
    new Map(
      [...FALLBACK_STRATEGIES, ...((strategiesQuery.data ?? []) as StrategyOption[])].map(
        (strategy) => [strategy.name, strategy]
      )
    ).values()
  );

  const exchangeOptions = Array.from(
    new Map(
      [
        ...FALLBACK_EXCHANGES,
        ...((exchangesQuery.data ?? []).map((exchange) => ({
          exchange: exchange.exchange,
          name: exchange.name,
        })) as ExchangeOption[]),
      ].map((exchange) => [exchange.exchange, exchange])
    ).values()
  );

  const createBot = trpc.bots.create.useMutation({
    onMutate: () => setSubmitError(null),
    onSuccess: () => router.push("/bots"),
    onError: (error) => setSubmitError(error.message),
  });

  const onSubmit = (data: BotFormData) => {
    createBot.mutate(data);
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));
  const next = async () => {
    const fields = STEP_FIELDS[step] ?? [];
    const isValid = fields.length === 0 || (await form.trigger(fields));
    if (isValid) {
      setStep((currentStep) => Math.min(STEPS.length - 1, currentStep + 1));
    }
  };

  const goToStep = async (targetStep: number) => {
    if (targetStep <= step) {
      setStep(targetStep);
      return;
    }

    const fields = STEP_FIELDS[step] ?? [];
    const isValid = fields.length === 0 || (await form.trigger(fields));
    if (isValid) {
      setStep(targetStep);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/bots" className="rounded-lg p-2" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
          Create Bot
        </h1>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                void goToStep(i);
              }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors"
              style={{
                background: i === step ? "var(--accent-dim)" : "transparent",
                color:
                  i === step ? "var(--accent)" : i < step ? "var(--profit)" : "var(--text-muted)",
              }}
            >
              {i < step ? <Check size={10} /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                ›
              </span>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="glass-panel p-6 space-y-5">
        {step === 0 && <StepStrategy form={form} strategies={strategyOptions} />}
        {step === 1 && <StepParameters form={form} />}
        {step === 2 && <StepExchange form={form} exchanges={exchangeOptions} />}
        {step === 3 && <StepRisk form={form} />}
        {step === 4 && <StepMode form={form} />}
        {step === 5 && <StepReview form={form} />}

        {submitError && (
          <p className="text-sm" style={{ color: "var(--loss)" }}>
            Failed to create bot: {submitError}
          </p>
        )}

        <div className="flex justify-between pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-30"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                void next();
              }}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-colors"
              style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={createBot.isPending}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-60"
              style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
            >
              <Check size={14} /> {createBot.isPending ? "Creating…" : "Create Bot"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs" style={{ color: "var(--loss)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function InputField({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors ${className}`}
      style={{
        background: "var(--bg-input)",
        color: "var(--text-primary)",
        border: "1px solid var(--border)",
      }}
      {...props}
    />
  );
}

function SelectField({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${className}`}
      style={{
        background: "var(--bg-input)",
        color: "var(--text-primary)",
        border: "1px solid var(--border)",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

function StepStrategy({
  form,
  strategies,
}: {
  form: UseFormReturn<BotFormData>;
  strategies: StrategyOption[];
}) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <h2 className="text-lg">Select Strategy</h2>
      <FormField label="Bot Name" htmlFor="bot-name" error={errors.name?.message}>
        <InputField id="bot-name" placeholder="My Trading Bot" {...register("name")} />
      </FormField>
      <FormField label="Strategy" htmlFor="bot-strategy" error={errors.strategy?.message}>
        <SelectField id="bot-strategy" {...register("strategy")}>
          <option value="">Select a strategy...</option>
          {strategies.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </FormField>
    </div>
  );
}

function StepParameters({ form }: { form: UseFormReturn<BotFormData> }) {
  const strategy = form.watch("strategy");
  return (
    <div className="space-y-4">
      <h2 className="text-lg">Strategy Parameters</h2>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Configure parameters for: {strategy || "—"}
      </p>
      <FormField label="Timeframe" htmlFor="bot-timeframe">
        <SelectField id="bot-timeframe" {...form.register("timeframe")}>
          {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
        </SelectField>
      </FormField>
    </div>
  );
}

function StepExchange({
  form,
  exchanges,
}: {
  form: UseFormReturn<BotFormData>;
  exchanges: ExchangeOption[];
}) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <h2 className="text-lg">Exchange & Pair</h2>
      <FormField label="Exchange" htmlFor="bot-exchange" error={errors.exchange?.message}>
        <SelectField id="bot-exchange" {...register("exchange")}>
          {exchanges.map((exchange) => (
            <option key={exchange.exchange} value={exchange.exchange}>
              {exchange.name}
            </option>
          ))}
        </SelectField>
      </FormField>
      <FormField label="Symbol" htmlFor="bot-symbol" error={errors.symbol?.message}>
        <InputField id="bot-symbol" placeholder="BTC/USDT" {...register("symbol")} />
      </FormField>
    </div>
  );
}

function StepRisk({ form }: { form: UseFormReturn<BotFormData> }) {
  const { register } = form;
  const trailingStopEnabled = form.watch("riskConfig.trailingStopEnabled");

  return (
    <div className="space-y-4">
      <h2 className="text-lg">Risk Management</h2>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Max Position Size %" htmlFor="risk-max-position">
          <InputField
            id="risk-max-position"
            type="number"
            step="1"
            {...register("riskConfig.maxPositionSizePercent", { valueAsNumber: true })}
          />
        </FormField>
        <FormField label="Max Drawdown %" htmlFor="risk-max-drawdown">
          <InputField
            id="risk-max-drawdown"
            type="number"
            step="1"
            {...register("riskConfig.maxDrawdownPercent", { valueAsNumber: true })}
          />
        </FormField>
        <FormField label="Risk Per Trade %" htmlFor="risk-per-trade">
          <InputField
            id="risk-per-trade"
            type="number"
            step="0.1"
            {...register("riskConfig.riskPerTradePercent", { valueAsNumber: true })}
          />
        </FormField>
        <FormField label="Max Concurrent Positions" htmlFor="risk-max-concurrent">
          <InputField
            id="risk-max-concurrent"
            type="number"
            step="1"
            {...register("riskConfig.maxConcurrentPositions", { valueAsNumber: true })}
          />
        </FormField>
        <FormField label="Max Daily Loss %" htmlFor="risk-max-daily-loss">
          <InputField
            id="risk-max-daily-loss"
            type="number"
            step="1"
            {...register("riskConfig.maxDailyLossPercent", { valueAsNumber: true })}
          />
        </FormField>
        <div className="col-span-2 rounded-lg p-3" style={{ background: "var(--bg-input)" }}>
          <label
            htmlFor="risk-trailing-stop-enabled"
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            <input
              id="risk-trailing-stop-enabled"
              type="checkbox"
              className="rounded"
              {...register("riskConfig.trailingStopEnabled")}
            />
            Enable trailing stop
          </label>
        </div>
        <FormField label="Trailing Stop %" htmlFor="risk-trailing-stop">
          <InputField
            id="risk-trailing-stop"
            type="number"
            step="0.1"
            disabled={!trailingStopEnabled}
            {...register("riskConfig.trailingStopPercent", { valueAsNumber: true })}
          />
        </FormField>
      </div>
    </div>
  );
}

function StepMode({ form }: { form: UseFormReturn<BotFormData> }) {
  const mode = form.watch("mode");
  return (
    <div className="space-y-4">
      <h2 className="text-lg">Mode Selection</h2>
      <div className="grid grid-cols-3 gap-3">
        {(["paper", "backtest", "live"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => form.setValue("mode", m, { shouldValidate: true })}
            className="rounded-xl p-4 text-left transition-all"
            style={{
              background: mode === m ? "var(--accent-dim)" : "var(--bg-input)",
              border: `1px solid ${mode === m ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            <div
              className="text-sm font-medium capitalize"
              style={{ color: mode === m ? "var(--accent)" : "var(--text-primary)" }}
            >
              {m}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {m === "paper" && "Simulated trading with real-time data"}
              {m === "backtest" && "Test against historical data"}
              {m === "live" && "Real money trading"}
            </div>
          </button>
        ))}
      </div>
      {mode === "live" && (
        <div
          className="rounded-lg p-3 text-xs"
          style={{ background: "rgba(248,113,113,0.1)", color: "var(--loss)" }}
        >
          ⚠ Live mode uses real money. Ensure your risk settings are appropriate.
        </div>
      )}
      {mode !== "backtest" && (
        <FormField label="Initial Balance (optional)" htmlFor="bot-current-balance">
          <InputField
            id="bot-current-balance"
            type="number"
            step="0.01"
            placeholder="10000"
            {...form.register("currentBalance", {
              setValueAs: (value) => (value === "" ? undefined : Number(value)),
            })}
          />
        </FormField>
      )}
    </div>
  );
}

function StepReview({ form }: { form: UseFormReturn<BotFormData> }) {
  const values = form.getValues();
  const rows = [
    ["Name", values.name],
    ["Strategy", values.strategy],
    ["Exchange", values.exchange],
    ["Symbol", values.symbol],
    ["Timeframe", values.timeframe],
    ["Mode", values.mode],
    ["Max Position", `${values.riskConfig.maxPositionSizePercent}%`],
    ["Max Drawdown", `${values.riskConfig.maxDrawdownPercent}%`],
    ["Risk/Trade", `${values.riskConfig.riskPerTradePercent}%`],
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg">Review & Create</h2>
      <div className="space-y-2">
        {rows.map(([label, val]) => (
          <div
            key={label}
            className="flex justify-between py-1.5 text-sm"
            style={{ borderBottom: "1px solid var(--grid)" }}
          >
            <span style={{ color: "var(--text-muted)" }}>{label}</span>
            <span style={{ color: "var(--text-primary)" }}>{val || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
