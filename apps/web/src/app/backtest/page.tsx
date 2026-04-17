"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    fees: z.object({
      maker: z.number().nonnegative(),
      taker: z.number().nonnegative(),
    }),
    slippage: z.object({
      enabled: z.boolean(),
      percentage: z.number().nonnegative(),
    }),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after the start time",
    path: ["endTime"],
  });

type BacktestFormData = z.infer<typeof backtestSchema>;

export default function BacktestPage() {
  const router = useRouter();
  const { data: backtests } = trpc.backtest.list.useQuery({ limit: 20 });

  const form = useForm<BacktestFormData>({
    resolver: zodResolver(backtestSchema),
    defaultValues: {
      name: "",
      strategy: "sma_crossover",
      strategyParams: {},
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "1h",
      startTime: Date.now() - 90 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      initialBalance: 10000,
      riskConfig: {
        maxPositionSizePercent: 10,
        maxDrawdownPercent: 20,
        riskPerTradePercent: 2,
        maxConcurrentPositions: 5,
        maxDailyLossPercent: 5,
        trailingStopEnabled: false,
        trailingStopPercent: 5,
      },
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: true, percentage: 0.0005 },
    },
  });

  const runBacktest = trpc.backtest.run.useMutation({
    onSuccess: (data) => router.push(`/backtest/${data.backtestId}`),
    onError: (error) => toast.error(`Failed to run backtest: ${error.message}`),
  });

  const onSubmit = (data: BacktestFormData) => runBacktest.mutate(data);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
        Backtesting
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Config Form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="glass-panel space-y-4 p-5">
          <h2 className="text-lg">New Backtest</h2>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="backtest-name"
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Name
              </label>
              <input
                id="backtest-name"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
                placeholder="Backtest name"
                {...form.register("name")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="backtest-strategy"
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Strategy
                </label>
                <select
                  id="backtest-strategy"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                  {...form.register("strategy")}
                >
                  <option value="sma_crossover">SMA Crossover</option>
                  <option value="rsi_mean_reversion">RSI Mean Reversion</option>
                  <option value="macd_trend">MACD Trend</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="backtest-timeframe"
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Timeframe
                </label>
                <select
                  id="backtest-timeframe"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                  {...form.register("timeframe")}
                >
                  {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
                    <option key={tf} value={tf}>
                      {tf}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="backtest-exchange"
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Exchange
                </label>
                <select
                  id="backtest-exchange"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                  {...form.register("exchange")}
                >
                  <option value="binance">Binance</option>
                  <option value="kraken">Kraken</option>
                  <option value="kucoin">KuCoin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="backtest-symbol"
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Symbol
                </label>
                <input
                  id="backtest-symbol"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                  placeholder="BTC/USDT"
                  {...form.register("symbol")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="backtest-initial-balance"
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Initial Balance
              </label>
              <input
                id="backtest-initial-balance"
                type="number"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
                {...form.register("initialBalance", { valueAsNumber: true })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="backtest-maker-fee"
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Maker Fee
                </label>
                <input
                  id="backtest-maker-fee"
                  type="number"
                  step="0.0001"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                  {...form.register("fees.maker", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="backtest-taker-fee"
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Taker Fee
                </label>
                <input
                  id="backtest-taker-fee"
                  type="number"
                  step="0.0001"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                  {...form.register("fees.taker", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={runBacktest.isPending}
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
          >
            {runBacktest.isPending ? "Running…" : "Run Backtest"}
          </button>
        </form>

        {/* Past Backtests */}
        <div className="glass-panel p-5">
          <h2 className="text-lg mb-4">Past Backtests</h2>
          {!backtests || backtests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart2
                size={48}
                style={{ color: "var(--text-muted)", opacity: 0.4 }}
                className="mb-4"
              />
              <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                No backtests yet
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                Run your first backtest using the form
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backtests.map((bt) => (
                <Link
                  key={bt.id}
                  href={`/backtest/${bt.id}`}
                  className="flex items-center justify-between rounded-lg p-3 transition-colors"
                  style={{ background: "var(--bg-input)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-input)")}
                >
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
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
