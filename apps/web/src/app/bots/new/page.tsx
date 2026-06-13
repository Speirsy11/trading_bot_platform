"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type FieldPath, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { toast } from "@/components/ui/Toaster";
import { resolveResearchExecutionAssumptions } from "@/lib/researchHandoff";
import { trpc } from "@/lib/trpc";

const executionAssumptionsSchema = z.object({
  marketMode: z.string().min(1),
  initialBalance: z.number().positive(),
  fees: z.object({
    maker: z.number().nonnegative(),
    taker: z.number().nonnegative(),
  }),
  slippage: z.object({
    enabled: z.boolean(),
    percentage: z.number().nonnegative(),
  }),
});

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
  promotionEvidence: z
    .object({
      sourceType: z.enum(["research", "backtest"]),
      sourceId: z.string().uuid(),
      sourceSweepId: z.string().uuid().optional(),
      sourceLabel: z.string().optional(),
      benchmarkStatus: z.string().optional(),
      alphaQualified: z.boolean().optional(),
      paperBotEligible: z.boolean().optional(),
      executionAssumptions: executionAssumptionsSchema.optional(),
      outOfSampleReturn: z.number().optional(),
      benchmarkReturn: z.number().optional(),
      excessReturn: z.number().optional(),
      maxDrawdown: z.number().optional(),
      sharpeRatio: z.number().optional(),
      profitFactor: z.number().optional(),
      totalTrades: z.number().optional(),
      verifiedAt: z.number().optional(),
    })
    .optional(),
  currentBalance: z.number().positive().optional(),
});

type BotFormData = z.infer<typeof botFormSchema>;
type PromotionEvidence = NonNullable<BotFormData["promotionEvidence"]>;
type ExecutionAssumptions = z.infer<typeof executionAssumptionsSchema>;

type StrategyParam = {
  name: string;
  inputType?: "number" | "boolean" | "select" | "text";
  defaultValue?: unknown;
  options?: string[];
  description?: string | null;
  min?: number | null;
  max?: number | null;
  integer?: boolean;
};
type StrategyOption = {
  key: string;
  name: string;
  description?: string;
  params?: StrategyParam[];
};
type ExchangeOption = { exchange: string; name: string };
type ReadinessStatus = "pass" | "watch" | "fail";
type PromotionReadinessCheck = {
  label: string;
  detail: string;
  status: ReadinessStatus;
};

const STEPS = ["Strategy", "Parameters", "Exchange & Pair", "Risk", "Run Mode", "Review"];

const FALLBACK_STRATEGIES: StrategyOption[] = [
  {
    key: "sma-crossover",
    name: "SMA Crossover",
    params: [
      { name: "fastPeriod", inputType: "number", defaultValue: 9, min: 2, max: 200, integer: true },
      {
        name: "slowPeriod",
        inputType: "number",
        defaultValue: 21,
        min: 5,
        max: 500,
        integer: true,
      },
    ],
  },
  {
    key: "rsi-mean-reversion",
    name: "RSI Mean Reversion",
    params: [
      { name: "rsiPeriod", inputType: "number", defaultValue: 14, min: 2, max: 100, integer: true },
      { name: "oversoldLevel", inputType: "number", defaultValue: 30, min: 0, max: 50 },
      { name: "overboughtLevel", inputType: "number", defaultValue: 70, min: 50, max: 100 },
    ],
  },
  {
    key: "bollinger-long-bounce",
    name: "Bollinger Long Bounce",
    params: [
      { name: "period", inputType: "number", defaultValue: 20, min: 2, max: 500, integer: true },
      { name: "stdDevMultiplier", inputType: "number", defaultValue: 2, min: 0.1, max: 10 },
      { name: "rsiPeriod", inputType: "number", defaultValue: 14, min: 2, max: 100, integer: true },
      { name: "rsiOversold", inputType: "number", defaultValue: 35, min: 0, max: 50 },
      {
        name: "exitBand",
        inputType: "select",
        defaultValue: "middle",
        options: ["middle", "upper"],
      },
    ],
  },
  {
    key: "donchian-breakout",
    name: "Donchian Breakout",
    params: [
      {
        name: "entryPeriod",
        inputType: "number",
        defaultValue: 55,
        min: 5,
        max: 200,
        integer: true,
      },
      {
        name: "exitPeriod",
        inputType: "number",
        defaultValue: 20,
        min: 2,
        max: 100,
        integer: true,
      },
      { name: "atrPeriod", inputType: "number", defaultValue: 14, min: 2, max: 100, integer: true },
      { name: "atrStop", inputType: "number", defaultValue: 2, min: 0, max: 10 },
    ],
  },
  {
    key: "ema-atr-trend",
    name: "EMA ATR Trend",
    params: [
      {
        name: "fastPeriod",
        inputType: "number",
        defaultValue: 20,
        min: 2,
        max: 200,
        integer: true,
      },
      {
        name: "slowPeriod",
        inputType: "number",
        defaultValue: 100,
        min: 5,
        max: 500,
        integer: true,
      },
      { name: "atrPeriod", inputType: "number", defaultValue: 14, min: 2, max: 100, integer: true },
      { name: "atrStop", inputType: "number", defaultValue: 2, min: 0.1, max: 10 },
    ],
  },
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

const TEMPLATES: Array<{ label: string; values: Partial<BotFormData> }> = [
  {
    label: "Conservative SMA Crossover",
    values: {
      strategy: "sma-crossover",
      strategyParams: { fastPeriod: 20, slowPeriod: 50 },
      timeframe: "4h",
      riskConfig: {
        maxPositionSizePercent: 5,
        maxDrawdownPercent: 10,
        riskPerTradePercent: 1,
        maxConcurrentPositions: 3,
        maxDailyLossPercent: 5,
        trailingStopEnabled: true,
        trailingStopPercent: 3,
      },
    },
  },
  {
    label: "Aggressive RSI Mean Reversion",
    values: {
      strategy: "rsi-mean-reversion",
      strategyParams: { rsiPeriod: 14, oversoldLevel: 30, overboughtLevel: 60 },
      timeframe: "1h",
      riskConfig: {
        maxPositionSizePercent: 15,
        maxDrawdownPercent: 20,
        riskPerTradePercent: 3,
        maxConcurrentPositions: 5,
        maxDailyLossPercent: 10,
        trailingStopEnabled: false,
        trailingStopPercent: 5,
      },
    },
  },
  {
    label: "Bollinger Long Bounce",
    values: {
      strategy: "bollinger-long-bounce",
      strategyParams: { period: 20, stdDevMultiplier: 2, rsiOversold: 35, exitBand: "middle" },
      timeframe: "1h",
      riskConfig: {
        maxPositionSizePercent: 10,
        maxDrawdownPercent: 15,
        riskPerTradePercent: 2,
        maxConcurrentPositions: 3,
        maxDailyLossPercent: 7,
        trailingStopEnabled: true,
        trailingStopPercent: 4,
      },
    },
  },
];

const draftKey = "bot-wizard-draft";

type RiskConfig = BotFormData["riskConfig"];

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
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mergeRiskConfig(
  defaults: RiskConfig,
  override: Partial<RiskConfig> | undefined
): RiskConfig {
  return { ...defaults, ...(override ?? {}) };
}

export default function CreateBotPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const strategiesQuery = trpc.strategies.catalog.useQuery();
  const strategyDraftsQuery = trpc.strategies.listDrafts.useQuery({});
  const exchangesQuery = trpc.exchanges.list.useQuery();
  const sourceBacktest = searchParams.get("sourceBacktest");
  const sourceResearch = searchParams.get("sourceResearch");
  const hasPromotionSource = Boolean(sourceBacktest || sourceResearch);
  const promotionSource = sourceBacktest ? "backtest" : sourceResearch ? "research" : null;
  const promotedStrategyParams = parseJsonParam<Record<string, unknown>>(
    searchParams.get("strategyParams")
  );
  const promotedRiskConfig = parseJsonParam<Partial<RiskConfig>>(searchParams.get("riskConfig"));
  const researchSourceQuery = trpc.research.getResult.useQuery(
    { resultId: sourceResearch ?? "" },
    { enabled: Boolean(sourceResearch) }
  );
  const backtestSourceQuery = trpc.backtest.getResults.useQuery(
    { backtestId: sourceBacktest ?? "" },
    { enabled: Boolean(sourceBacktest) }
  );
  const defaultRiskConfig: RiskConfig = {
    maxPositionSizePercent: 10,
    maxDrawdownPercent: 20,
    riskPerTradePercent: 2,
    maxConcurrentPositions: 5,
    maxDailyLossPercent: 5,
    trailingStopEnabled: false,
    trailingStopPercent: 5,
  };

  const form = useForm<BotFormData>({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      name: searchParams.get("name") ?? "",
      strategy: searchParams.get("strategy") ?? "sma-crossover",
      strategyParams: promotedStrategyParams ?? {},
      exchange: searchParams.get("exchange") ?? "binance",
      symbol: searchParams.get("symbol") ?? "BTC/USDT",
      timeframe: searchParams.get("timeframe") ?? "1h",
      mode: hasPromotionSource ? "paper" : searchParams.get("mode") === "live" ? "live" : "paper",
      riskConfig: mergeRiskConfig(defaultRiskConfig, promotedRiskConfig),
      promotionEvidence: buildInitialPromotionEvidence(sourceBacktest, sourceResearch),
      currentBalance: parseOptionalNumber(searchParams.get("balance")),
    },
  });

  const [templateOpen, setTemplateOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);
  const lastStrategyRef = useRef(form.getValues("strategy"));

  const strategyOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...FALLBACK_STRATEGIES,
            ...((strategiesQuery.data?.strategies ?? []) as StrategyOption[]),
          ].map((strategy) => [strategy.key, strategy])
        ).values()
      ),
    [strategiesQuery.data?.strategies]
  );

  const exchangeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...FALLBACK_EXCHANGES,
            ...((exchangesQuery.data ?? []).map((exchange) => ({
              exchange: exchange.exchange,
              name: exchange.name,
            })) as ExchangeOption[]),
          ].map((exchange) => [exchange.exchange, exchange])
        ).values()
      ),
    [exchangesQuery.data]
  );

  const selectedStrategyKey = form.watch("strategy");
  const selectedStrategy = strategyOptions.find((strategy) => strategy.key === selectedStrategyKey);

  // Load draft on mount. Promoted research/backtests intentionally bypass stale drafts.
  useEffect(() => {
    if (hasPromotionSource) {
      localStorage.removeItem(draftKey);
      form.setValue("mode", "paper", { shouldValidate: true });
      toast.info(
        sourceBacktest
          ? "Backtest config loaded into a paper bot draft"
          : "Research config loaded into a paper bot draft"
      );
      return;
    }

    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<BotFormData>;
        Object.entries(draft).forEach(([key, value]) => {
          form.setValue(key as keyof BotFormData, value as never);
        });
        toast.info("Draft restored");
      }
    } catch {
      // ignore corrupt draft
    }
  }, [form, hasPromotionSource, sourceBacktest]);

  useEffect(() => {
    if (!sourceResearch || !researchSourceQuery.data) return;
    const result = researchSourceQuery.data;
    form.setValue(
      "promotionEvidence",
      {
        sourceType: "research",
        sourceId: sourceResearch,
        sourceSweepId: readSourceSweepId(result.sourceSweep),
        sourceLabel: `${result.strategyName} · ${result.timeframe}`,
        benchmarkStatus: result.benchmarkStatus,
        alphaQualified: Boolean(result.alphaQualified),
        paperBotEligible: Boolean(result.paperBotEligible),
        executionAssumptions: resolveResearchExecutionAssumptions(result.executionAssumptions),
        outOfSampleReturn: result.outOfSampleReturn,
        benchmarkReturn: numberFromUnknown(
          (result.testMetrics as { benchmark?: { totalReturn?: unknown } }).benchmark?.totalReturn
        ),
        excessReturn: numberFromUnknown(
          (result.testMetrics as { excessReturn?: unknown }).excessReturn
        ),
        maxDrawdown: result.maxDrawdown,
        sharpeRatio: result.sharpeRatio,
        profitFactor: result.profitFactor,
        totalTrades: result.totalTrades,
        verifiedAt: Date.now(),
      },
      { shouldValidate: true }
    );
  }, [form, researchSourceQuery.data, sourceResearch]);

  useEffect(() => {
    if (!sourceBacktest || !backtestSourceQuery.data) return;
    const result = backtestSourceQuery.data;
    form.setValue(
      "promotionEvidence",
      {
        sourceType: "backtest",
        sourceId: sourceBacktest,
        sourceLabel: `${result.strategy} · ${result.symbol} · ${result.timeframe}`,
        executionAssumptions: buildBacktestExecutionAssumptions(result),
        outOfSampleReturn: result.totalPnlPercent,
        maxDrawdown: result.maxDrawdown,
        sharpeRatio: result.sharpeRatio,
        profitFactor: result.profitFactor,
        totalTrades: result.totalTrades ?? 0,
        verifiedAt: Date.now(),
      },
      { shouldValidate: true }
    );
  }, [backtestSourceQuery.data, form, sourceBacktest]);

  useEffect(() => {
    if (!selectedStrategy) return;

    const defaults = getDefaultStrategyParams(selectedStrategy);
    const currentParams = form.getValues("strategyParams") ?? {};
    const strategyChanged = lastStrategyRef.current !== selectedStrategyKey;

    if (strategyChanged) {
      lastStrategyRef.current = selectedStrategyKey;
      form.setValue("strategyParams", defaults, { shouldDirty: true, shouldValidate: true });
      return;
    }

    if (Object.keys(currentParams).length === 0 && Object.keys(defaults).length > 0) {
      form.setValue("strategyParams", defaults, { shouldValidate: true });
    }
  }, [form, selectedStrategy, selectedStrategyKey]);

  // Save draft on every change
  useEffect(() => {
    const subscription = form.watch((values) => {
      localStorage.setItem(draftKey, JSON.stringify(values));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Close template dropdown on outside click
  useEffect(() => {
    if (!templateOpen) return;
    const handler = (e: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setTemplateOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [templateOpen]);

  const loadTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    Object.entries(tpl.values).forEach(([key, value]) => {
      form.setValue(key as keyof BotFormData, value as never, { shouldValidate: true });
    });
    setTemplateOpen(false);
    setStep(0);
    toast.info("Template loaded");
  };

  const loadStrategyDraft = (draftId: string) => {
    const draft = strategyDraftsQuery.data?.find((item) => item.id === draftId);
    if (!draft) return;

    form.setValue("name", `${draft.name} paper run`, { shouldValidate: true });
    form.setValue("strategy", draft.strategy, { shouldValidate: true });
    form.setValue("strategyParams", (draft.strategyParams as Record<string, unknown>) ?? {});
    form.setValue("riskConfig", draft.riskConfig as RiskConfig, { shouldValidate: true });
    form.setValue("exchange", draft.exchange, { shouldValidate: true });
    form.setValue("symbol", draft.symbol, { shouldValidate: true });
    form.setValue("timeframe", draft.timeframe, { shouldValidate: true });
    form.setValue("mode", "paper", { shouldValidate: true });
    setStep(0);
    toast.info("Strategy draft loaded into paper bot");
  };

  const createBot = trpc.bots.create.useMutation({
    onSuccess: () => router.push("/bots"),
    onError: (error) => toast.error(`Failed to create bot: ${error.message}`),
  });

  const onSubmit = async (data: BotFormData) => {
    await createBot.mutateAsync(data);
    localStorage.removeItem(draftKey);
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
        <div>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            {hasPromotionSource ? "Create Paper Bot" : "Create Bot"}
          </h1>
          {hasPromotionSource && (
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Prefilled from {sourceBacktest ? "backtest" : "research"}{" "}
              {(sourceBacktest ?? sourceResearch)?.slice(0, 8)}. Review the config, then run it
              safely in paper mode.
            </p>
          )}
        </div>
      </div>

      {hasPromotionSource && (
        <div
          className="space-y-2 rounded-xl p-4 text-sm"
          style={{ background: "var(--accent-dim)", color: "var(--text-primary)" }}
        >
          <div>
            This bot draft inherits the strategy, market, risk settings and starting balance from
            the {sourceBacktest ? "backtest" : "qualified research result"}. Keep it in{" "}
            <strong>paper mode</strong> until it behaves well on live data.
          </div>
          <PromotionEvidenceLine
            evidence={form.watch("promotionEvidence")}
            loading={researchSourceQuery.isLoading || backtestSourceQuery.isLoading}
          />
        </div>
      )}

      {/* Step Indicator + Templates */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-1 flex-wrap">
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

        {/* Templates dropdown */}
        <div className="relative shrink-0" ref={templateRef}>
          <button
            type="button"
            onClick={() => setTemplateOpen((o) => !o)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition-colors"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            Templates <ChevronDown size={12} />
          </button>
          {templateOpen && (
            <div
              className="absolute right-0 z-50 mt-1 w-56 rounded-lg py-1 shadow-lg"
              style={{
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
              }}
            >
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => loadTemplate(tpl)}
                  className="w-full px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent-dim)]"
                  style={{ color: "var(--text-primary)" }}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        className="glass-panel p-6 space-y-5"
      >
        {step === 0 && (
          <StepStrategy
            form={form}
            strategies={strategyOptions}
            drafts={strategyDraftsQuery.data ?? []}
            onLoadDraft={loadStrategyDraft}
          />
        )}
        {step === 1 && (
          <StepParameters
            form={form}
            strategy={selectedStrategy}
            promotionSource={promotionSource}
          />
        )}
        {step === 2 && <StepExchange form={form} exchanges={exchangeOptions} />}
        {step === 3 && <StepRisk form={form} />}
        {step === 4 && <StepMode form={form} promotionSource={promotionSource} />}
        {step === 5 && (
          <StepReview form={form} sourceBacktest={sourceBacktest} sourceResearch={sourceResearch} />
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
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {typeof children === "object" && children !== null
        ? React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
            ...(error !== undefined && { "aria-invalid": !!error }),
            ...(errorId !== undefined && error !== undefined && { "aria-describedby": errorId }),
          })
        : children}
      {error && (
        <p id={errorId} className="text-xs" role="alert" style={{ color: "var(--loss)" }}>
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
  drafts,
  onLoadDraft,
}: {
  form: UseFormReturn<BotFormData>;
  strategies: StrategyOption[];
  drafts: Array<{
    id: string;
    name: string;
    strategy: string;
    symbol: string;
    timeframe: string;
  }>;
  onLoadDraft: (draftId: string) => void;
}) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <h2 className="text-lg">Select Strategy</h2>
      <FormField label="Saved Strategy Draft" htmlFor="bot-draft">
        <SelectField
          id="bot-draft"
          defaultValue=""
          onChange={(event) => {
            onLoadDraft(event.target.value);
            event.currentTarget.value = "";
          }}
        >
          <option value="">Load a saved draft…</option>
          {drafts.map((draft) => (
            <option key={draft.id} value={draft.id}>
              {draft.name} · {draft.symbol} · {draft.timeframe}
            </option>
          ))}
        </SelectField>
      </FormField>
      <FormField label="Bot Name" htmlFor="bot-name" error={errors.name?.message}>
        <InputField id="bot-name" placeholder="My Trading Bot" {...register("name")} />
      </FormField>
      <FormField label="Strategy" htmlFor="bot-strategy" error={errors.strategy?.message}>
        <SelectField id="bot-strategy" {...register("strategy")}>
          <option value="">Select a strategy...</option>
          {strategies.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </FormField>
    </div>
  );
}

function StepParameters({
  form,
  strategy,
  promotionSource,
}: {
  form: UseFormReturn<BotFormData>;
  strategy?: StrategyOption;
  promotionSource?: "backtest" | "research" | null;
}) {
  const strategyKey = form.watch("strategy");
  const strategyParams = form.watch("strategyParams") ?? {};
  const paramDefinitions = strategy?.params ?? [];
  return (
    <div className="space-y-4">
      <h2 className="text-lg">Strategy Parameters</h2>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Configure parameters for: {strategy?.name ?? (strategyKey || "—")}
      </p>
      {promotionSource && (
        <div
          className="rounded-lg p-3 text-xs"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          Exact {promotionSource} parameters are loaded. Review them before creating the paper bot.
        </div>
      )}
      <FormField label="Timeframe" htmlFor="bot-timeframe">
        <SelectField id="bot-timeframe" {...form.register("timeframe")}>
          {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
        </SelectField>
      </FormField>
      {paramDefinitions.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {paramDefinitions.map((param) => (
            <StrategyParamField
              key={param.name}
              form={form}
              param={param}
              value={strategyParams[param.name] ?? param.defaultValue ?? ""}
            />
          ))}
        </div>
      ) : (
        <div
          className="rounded-lg p-3 text-xs"
          style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
        >
          This strategy has no editable catalog parameters.
        </div>
      )}
    </div>
  );
}

function StrategyParamField({
  form,
  param,
  value,
}: {
  form: UseFormReturn<BotFormData>;
  param: StrategyParam;
  value: unknown;
}) {
  const fieldId = `strategy-param-${param.name}`;
  const setParam = (nextValue: unknown) => {
    const current = form.getValues("strategyParams") ?? {};
    const next = { ...current };
    if (nextValue === undefined || nextValue === "") {
      delete next[param.name];
    } else {
      next[param.name] = nextValue;
    }
    form.setValue("strategyParams", next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <FormField label={formatParamLabel(param.name)} htmlFor={fieldId}>
      <div className="space-y-1.5">
        {param.inputType === "select" ? (
          <SelectField
            id={fieldId}
            value={String(value)}
            onChange={(event) => setParam(event.target.value)}
          >
            {(param.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>
        ) : param.inputType === "boolean" ? (
          <label
            htmlFor={fieldId}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
          >
            <input
              id={fieldId}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => setParam(event.target.checked)}
            />
            Enabled
          </label>
        ) : param.inputType === "number" || typeof value === "number" ? (
          <InputField
            id={fieldId}
            type="number"
            min={param.min ?? undefined}
            max={param.max ?? undefined}
            step={param.integer ? 1 : "any"}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(event) =>
              setParam(event.target.value === "" ? undefined : Number(event.target.value))
            }
          />
        ) : (
          <InputField
            id={fieldId}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(event) => setParam(event.target.value)}
          />
        )}
        {param.description && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {param.description}
          </p>
        )}
      </div>
    </FormField>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div
          className="col-span-1 rounded-lg p-3 sm:col-span-2"
          style={{ background: "var(--bg-input)" }}
        >
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

function StepMode({
  form,
  promotionSource,
}: {
  form: UseFormReturn<BotFormData>;
  promotionSource?: "backtest" | "research" | null;
}) {
  const mode = form.watch("mode");
  const modes = promotionSource ? (["paper"] as const) : (["paper", "live"] as const);
  return (
    <div className="space-y-4">
      <h2 className="text-lg">Mode Selection</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modes.map((m) => (
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
              {m === "live" && "Real crypto execution through configured exchange credentials"}
            </div>
          </button>
        ))}
      </div>
      {promotionSource && mode === "paper" && (
        <div
          className="rounded-lg p-3 text-xs"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          Research and backtest promotions start in paper mode with simulated orders.
        </div>
      )}
      {mode === "live" && (
        <div
          className="rounded-lg p-3 text-xs"
          style={{ background: "rgba(248,113,113,0.1)", color: "var(--loss)" }}
        >
          ⚠ Live mode uses real money. Ensure your risk settings are appropriate.
        </div>
      )}
      <FormField label="Initial Balance (paper mode)" htmlFor="bot-current-balance">
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
    </div>
  );
}

function StepReview({
  form,
  sourceBacktest,
  sourceResearch,
}: {
  form: UseFormReturn<BotFormData>;
  sourceBacktest?: string | null;
  sourceResearch?: string | null;
}) {
  const values = form.watch();
  const evidence = values.promotionEvidence;
  const readinessChecks = buildPromotionReadinessChecks(values, {
    sourceBacktest,
    sourceResearch,
  });
  const rows = [
    ...(sourceBacktest ? [["Source", `Backtest ${sourceBacktest.slice(0, 8)}`]] : []),
    ...(sourceResearch ? [["Source", `Research ${sourceResearch.slice(0, 8)}`]] : []),
    ...(evidence?.sourceLabel ? [["Evidence", evidence.sourceLabel]] : []),
    ...(evidence?.benchmarkStatus
      ? [["Benchmark gate", formatBenchmarkStatus(evidence.benchmarkStatus)]]
      : []),
    ...(evidence?.excessReturn != null
      ? [["Excess return", formatSignedPercent(evidence.excessReturn)]]
      : []),
    ...(evidence?.outOfSampleReturn != null
      ? [["Return", formatSignedPercent(evidence.outOfSampleReturn)]]
      : []),
    ...(evidence?.maxDrawdown != null
      ? [["Max drawdown", `-${evidence.maxDrawdown.toFixed(2)}%`]]
      : []),
    ...(evidence?.totalTrades != null ? [["Trades", evidence.totalTrades.toLocaleString()]] : []),
    ...(evidence?.executionAssumptions
      ? [["Execution", formatExecutionAssumptions(evidence.executionAssumptions)]]
      : []),
    ["Name", values.name],
    ["Strategy", values.strategy],
    ["Parameters", formatStrategyParams(values.strategyParams)],
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
      {(sourceBacktest || sourceResearch) && (
        <PromotionReadinessChecklist checks={readinessChecks} />
      )}
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

function PromotionReadinessChecklist({ checks }: { checks: PromotionReadinessCheck[] }) {
  const passedCount = checks.filter((check) => check.status === "pass").length;

  return (
    <div
      className="space-y-3 rounded-lg p-3"
      style={{
        background: "var(--bg-input)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} style={{ color: "var(--accent)" }} />
          <h3 className="text-sm" style={{ color: "var(--text-primary)" }}>
            Paper readiness checklist
          </h3>
        </div>
        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {passedCount}/{checks.length} clear
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {checks.map((check) => {
          const style = readinessStyle(check.status);
          return (
            <div
              key={check.label}
              className="flex min-h-[72px] gap-2 rounded-lg p-2"
              style={{
                background: style.background,
                border: `1px solid ${style.border}`,
              }}
            >
              <div className="mt-0.5 shrink-0" style={{ color: style.color }}>
                {check.status === "pass" ? <Check size={14} /> : <AlertTriangle size={14} />}
              </div>
              <div className="min-w-0">
                <div className="text-xs" style={{ color: "var(--text-primary)" }}>
                  {check.label}
                </div>
                <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                  {check.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildPromotionReadinessChecks(
  values: BotFormData,
  source: { sourceBacktest?: string | null; sourceResearch?: string | null }
): PromotionReadinessCheck[] {
  const evidence = values.promotionEvidence;
  const risk = values.riskConfig;
  const sourceType = source.sourceResearch ? "research" : source.sourceBacktest ? "backtest" : null;
  const sourceAttached = Boolean(evidence?.sourceId && evidence.sourceType);
  const hasCoreConfig = Boolean(
    values.strategy && values.exchange && values.symbol && values.timeframe
  );
  const conservativeRisk =
    risk.maxPositionSizePercent <= 10 &&
    risk.maxDrawdownPercent <= 20 &&
    risk.riskPerTradePercent <= 2 &&
    risk.maxDailyLossPercent <= 5;

  const checks: PromotionReadinessCheck[] = [
    {
      label: "Source evidence attached",
      detail: sourceAttached
        ? (evidence?.sourceLabel ??
          `${evidence?.sourceType ?? "Source"} ${evidence?.sourceId.slice(0, 8)}`)
        : "The source result is still loading or unavailable.",
      status: sourceAttached ? "pass" : "fail",
    },
    {
      label: "Paper-only promotion",
      detail:
        values.mode === "paper"
          ? "Promotion sources are locked to simulated execution."
          : "Switch this promoted bot back to paper mode.",
      status: values.mode === "paper" ? "pass" : "fail",
    },
    buildEvidenceQualityCheck(sourceType, evidence),
    buildBenchmarkContextCheck(sourceType, evidence),
    buildExecutionAssumptionsCheck(evidence),
    {
      label: "Conservative risk caps",
      detail: `${risk.maxPositionSizePercent}% max position, ${risk.riskPerTradePercent}% risk/trade, ${risk.maxDailyLossPercent}% daily loss`,
      status: conservativeRisk ? "pass" : "watch",
    },
    {
      label: "Reproducible config",
      detail: hasCoreConfig
        ? `${values.strategy} on ${values.exchange} ${values.symbol} ${values.timeframe}`
        : "Strategy, venue, symbol, and timeframe must be set.",
      status: hasCoreConfig ? "pass" : "fail",
    },
    {
      label: "Paper capital",
      detail:
        values.currentBalance && values.currentBalance > 0
          ? `${formatCompactCurrency(values.currentBalance)} starting balance`
          : "No balance set; the server will use the strategy default.",
      status: values.currentBalance && values.currentBalance > 0 ? "pass" : "watch",
    },
  ];

  return checks;
}

function buildEvidenceQualityCheck(
  sourceType: "research" | "backtest" | null,
  evidence: PromotionEvidence | undefined
): PromotionReadinessCheck {
  if (sourceType === "research") {
    if (!evidence?.sourceId || evidence.paperBotEligible === undefined) {
      return {
        label: "Historical-profit gate",
        detail: "Waiting for the research result evidence to load.",
        status: "watch",
      };
    }

    if (!evidence.paperBotEligible) {
      return {
        label: "Historical-profit gate",
        detail: "This research result did not pass the paper-bot eligibility gate.",
        status: "fail",
      };
    }

    const benchmarkStatus = formatBenchmarkStatus(evidence.benchmarkStatus);
    return {
      label: "Historical-profit gate",
      detail: `${benchmarkStatus} · paper trading allowed`,
      status: "pass",
    };
  }

  if (sourceType === "backtest") {
    const returnText =
      evidence?.outOfSampleReturn == null
        ? "Return not loaded yet"
        : `Return ${formatSignedPercent(evidence.outOfSampleReturn)}`;
    const tradesText =
      evidence?.totalTrades == null ? "" : ` · ${evidence.totalTrades.toLocaleString()} trades`;
    const clearsSanity =
      evidence?.outOfSampleReturn != null &&
      evidence.outOfSampleReturn > 0 &&
      (evidence.totalTrades ?? 0) >= 5;

    return {
      label: "Backtest sanity",
      detail: `${returnText}${tradesText}`,
      status: clearsSanity ? "pass" : "watch",
    };
  }

  return {
    label: "Evidence quality",
    detail: "No promotion source is attached.",
    status: "watch",
  };
}

function buildExecutionAssumptionsCheck(
  evidence: PromotionEvidence | undefined
): PromotionReadinessCheck {
  if (!evidence?.executionAssumptions) {
    return {
      label: "Execution assumptions",
      detail: "Waiting for source fees, slippage, market mode, and starting capital.",
      status: "watch",
    };
  }

  return {
    label: "Execution assumptions",
    detail: formatExecutionAssumptions(evidence.executionAssumptions),
    status: "pass",
  };
}

function buildBenchmarkContextCheck(
  sourceType: "research" | "backtest" | null,
  evidence: PromotionEvidence | undefined
): PromotionReadinessCheck {
  if (sourceType === "research") {
    if (!evidence?.benchmarkStatus) {
      return {
        label: "Benchmark context",
        detail: "Waiting for buy-and-hold comparison evidence.",
        status: "watch",
      };
    }

    const excess =
      evidence.excessReturn == null
        ? "Excess n/a"
        : `Excess ${formatSignedPercent(evidence.excessReturn)}`;
    return {
      label: "Benchmark context",
      detail: `${formatBenchmarkStatus(evidence.benchmarkStatus)} · ${excess}`,
      status: evidence.alphaQualified ? "pass" : "watch",
    };
  }

  if (sourceType === "backtest") {
    return {
      label: "Benchmark context",
      detail: "Manual backtest evidence does not include top-10 benchmark alpha.",
      status: "watch",
    };
  }

  return {
    label: "Benchmark context",
    detail: "Attach a source result to compare strategy performance.",
    status: "watch",
  };
}

function readinessStyle(status: ReadinessStatus) {
  if (status === "pass") {
    return {
      background: "rgba(110, 231, 160, 0.08)",
      border: "rgba(110, 231, 160, 0.22)",
      color: "var(--profit)",
    };
  }

  if (status === "fail") {
    return {
      background: "rgba(248, 113, 113, 0.08)",
      border: "rgba(248, 113, 113, 0.22)",
      color: "var(--loss)",
    };
  }

  return {
    background: "rgba(251, 191, 36, 0.08)",
    border: "rgba(251, 191, 36, 0.22)",
    color: "var(--accent)",
  };
}

function PromotionEvidenceLine({
  evidence,
  loading,
}: {
  evidence?: PromotionEvidence;
  loading: boolean;
}) {
  if (loading && !evidence?.sourceLabel) {
    return (
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        Loading source evidence…
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        Source evidence will be attached before the bot is created.
      </div>
    );
  }

  const chips = [
    evidence.sourceLabel,
    formatBenchmarkStatus(evidence.benchmarkStatus),
    evidence.excessReturn != null ? `Excess ${formatSignedPercent(evidence.excessReturn)}` : null,
    evidence.outOfSampleReturn != null
      ? `Return ${formatSignedPercent(evidence.outOfSampleReturn)}`
      : null,
    evidence.maxDrawdown != null ? `DD -${evidence.maxDrawdown.toFixed(2)}%` : null,
    evidence.executionAssumptions
      ? formatExecutionAssumptionsChip(evidence.executionAssumptions)
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full px-2.5 py-1 text-xs"
          style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function getDefaultStrategyParams(strategy: StrategyOption): Record<string, unknown> {
  return Object.fromEntries(
    (strategy.params ?? [])
      .filter((param) => param.defaultValue !== undefined && param.defaultValue !== null)
      .map((param) => [param.name, param.defaultValue])
  );
}

function formatParamLabel(name: string) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function formatStrategyParams(params: Record<string, unknown>) {
  const entries = Object.entries(params ?? {});
  if (entries.length === 0) return "Default";
  return entries.map(([key, value]) => `${formatParamLabel(key)}: ${String(value)}`).join(", ");
}

function buildInitialPromotionEvidence(
  sourceBacktest: string | null,
  sourceResearch: string | null
): PromotionEvidence | undefined {
  if (sourceBacktest) {
    return {
      sourceType: "backtest",
      sourceId: sourceBacktest,
      verifiedAt: Date.now(),
    };
  }

  if (sourceResearch) {
    return {
      sourceType: "research",
      sourceId: sourceResearch,
      verifiedAt: Date.now(),
    };
  }

  return undefined;
}

function readSourceSweepId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

function buildBacktestExecutionAssumptions(value: {
  initialBalance?: unknown;
  metrics?: unknown;
}): ExecutionAssumptions {
  const metrics = isRecord(value.metrics) ? value.metrics : {};
  const fees = isRecord(metrics["fees"]) ? metrics["fees"] : {};
  const slippage = isRecord(metrics["slippage"]) ? metrics["slippage"] : {};

  return {
    marketMode: "spot",
    initialBalance: numberFromUnknown(value.initialBalance) ?? 10_000,
    fees: {
      maker: numberFromUnknown(fees["maker"]) ?? 0.001,
      taker: numberFromUnknown(fees["taker"]) ?? 0.001,
    },
    slippage: {
      enabled: typeof slippage["enabled"] === "boolean" ? slippage["enabled"] : true,
      percentage: numberFromUnknown(slippage["percentage"]) ?? 0.0005,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFromUnknown(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatExecutionAssumptions(value: ExecutionAssumptions) {
  const slippage = value.slippage.enabled ? formatRate(value.slippage.percentage) : "off";
  return `${value.marketMode} · ${formatCompactCurrency(value.initialBalance)} · maker ${formatRate(
    value.fees.maker
  )} / taker ${formatRate(value.fees.taker)} · slip ${slippage}`;
}

function formatExecutionAssumptionsChip(value: ExecutionAssumptions) {
  return `${value.marketMode} ${formatCompactCurrency(value.initialBalance)}`;
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCompactCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatBenchmarkStatus(value?: string) {
  if (value === "alpha-qualified") return "Benchmark alpha";
  if (value === "profit-only") return "Historical profit";
  if (value === "benchmark-beater") return "Benchmark beater";
  if (value === "research") return "Research candidate";
  return value ?? "Historical evidence";
}
