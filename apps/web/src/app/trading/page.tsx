"use client";

import {
  Activity,
  BarChart3,
  Bot,
  Database,
  FlaskConical,
  GitCompare,
  LineChart,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import {
  formatCompact,
  formatCurrency,
  formatDateShort,
  formatNumber,
  formatPercent,
  pnlColor,
} from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useUiStore } from "@/stores/ui";

const TOP_SYMBOLS = [
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "ADA/USDT",
  "XRP/USDT",
  "TRX/USDT",
  "ZEC/USDT",
  "DOGE/USDT",
  "BCH/USDT",
  "SOL/USDT",
];

const DEFAULT_SYMBOL = "BTC/USDT";
const TIMEFRAMES = ["1m", "15m", "1h", "4h"];

export default function TradingPage() {
  const selectedSymbol = useUiStore((s) => s.selectedSymbol);
  const selectedExchange = useUiStore((s) => s.selectedExchange);
  const setSelectedSymbol = useUiStore((s) => s.setSelectedSymbol);
  const [timeframe, setTimeframe] = useState("1h");
  const [compareSymbol, setCompareSymbol] = useState("ETH/USDT");

  const symbolsQuery = trpc.market.getSymbols.useQuery(
    { exchange: selectedExchange, collectedOnly: true },
    { staleTime: 60_000 }
  );
  const availableSymbols = symbolsQuery.data?.length ? symbolsQuery.data : TOP_SYMBOLS;
  const primarySymbol = availableSymbols.includes(selectedSymbol) ? selectedSymbol : DEFAULT_SYMBOL;
  const activeCompareSymbol =
    compareSymbol !== "none" &&
    compareSymbol !== primarySymbol &&
    availableSymbols.includes(compareSymbol)
      ? compareSymbol
      : undefined;

  const snapshot = trpc.market.getChartSnapshot.useQuery(
    {
      exchange: selectedExchange,
      symbol: primarySymbol,
      timeframe,
      compareSymbol: activeCompareSymbol,
      limit: timeframe === "1m" ? 900 : 700,
    },
    { enabled: Boolean(primarySymbol), refetchInterval: 60_000 }
  );

  const candles = snapshot.data?.candles ?? [];
  const summary = snapshot.data?.summary;
  const coverage = snapshot.data?.coverage;
  const compare = snapshot.data?.compare;
  const compareCoverage = compare?.coverage;
  const lastPrice = summary?.latestPrice ?? candles[candles.length - 1]?.close ?? 0;
  const freshnessMs = coverage?.latestCandleAgeMs ?? summary?.latestCandleAgeMs ?? null;
  const compareFreshnessMs =
    compareCoverage?.latestCandleAgeMs ?? compare?.summary.latestCandleAgeMs;

  const comparisonTitle = useMemo(() => {
    if (!activeCompareSymbol || !compare) return "Market return";
    return `${primarySymbol} vs ${activeCompareSymbol}`;
  }, [activeCompareSymbol, compare, primarySymbol]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <LineChart size={20} style={{ color: "var(--accent)" }} />
            <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
              Charts
            </h1>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-2xl tabular-nums" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(lastPrice)}
            </span>
            <span className="tabular-nums" style={{ color: pnlColor(summary?.returnPct ?? 0) }}>
              {formatMaybePercent(summary?.returnPct)}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {summary?.candleCount ? `${summary.candleCount.toLocaleString()} bars` : "No bars"}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Harvester {timeframe}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Control label="Symbol">
            <select
              value={primarySymbol}
              onChange={(event) => setSelectedSymbol(event.target.value)}
              className="h-10 min-w-[150px] rounded-lg px-3 text-sm outline-none"
              style={selectStyle}
            >
              {availableSymbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </Control>

          <Control label="Compare">
            <select
              value={compareSymbol}
              onChange={(event) => setCompareSymbol(event.target.value)}
              className="h-10 min-w-[150px] rounded-lg px-3 text-sm outline-none"
              style={selectStyle}
            >
              <option value="none">None</option>
              {availableSymbols
                .filter((symbol) => symbol !== primarySymbol)
                .map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
            </select>
          </Control>

          <div className="space-y-1">
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Timeframe
            </div>
            <div
              className="grid h-10 grid-cols-4 overflow-hidden rounded-lg"
              style={{ border: "1px solid var(--border)" }}
            >
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className="min-w-12 px-3 text-xs transition-colors"
                  style={{
                    color: tf === timeframe ? "var(--primary-foreground)" : "var(--text-muted)",
                    background: tf === timeframe ? "var(--accent)" : "var(--bg-input)",
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={Activity}
          label="Return"
          value={formatMaybePercent(summary?.returnPct)}
          tone={pnlColor(summary?.returnPct ?? 0)}
        />
        <MetricCard
          icon={BarChart3}
          label="Range"
          value={formatMaybePercent(summary?.rangePct, false)}
          detail={`${formatMaybeCurrency(summary?.low)} / ${formatMaybeCurrency(summary?.high)}`}
        />
        <MetricCard
          icon={Database}
          label="Coverage"
          value={coverage ? `${formatNumber(coverage.completeness, 2)}%` : "—"}
          detail={`${(coverage?.totalCandles ?? 0).toLocaleString()} source bars`}
        />
        <MetricCard
          icon={RefreshCw}
          label="Freshness"
          value={formatAge(freshnessMs)}
          detail={coverage?.latest ? formatDateShort(coverage.latest) : "No latest candle"}
        />
        <MetricCard
          icon={GitCompare}
          label="Relative"
          value={formatMaybePercent(relativeSpread(summary?.returnPct, compare?.summary.returnPct))}
          detail={activeCompareSymbol ?? "No comparison"}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Market"
          value="Spot"
          detail="Long/flat research model"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ErrorBoundary>
          <section className="glass-panel self-start p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {primarySymbol} · {timeframe}
                </h2>
                <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  SMA 20 · EMA 50 · BB 20x2 · RSI 14 · Volume
                </div>
              </div>
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {snapshot.isFetching && <RefreshCw size={13} className="animate-spin" />}
                {snapshot.isError
                  ? snapshot.error.message
                  : `${candles.length.toLocaleString()} loaded`}
              </div>
            </div>
            <CandlestickChart
              data={candles}
              height={560}
              showIndicatorControls
              showVolume
              defaultIndicators={["SMA", "EMA"]}
              indicators={{
                sma: { period: 20, color: "#c8a55a" },
                ema: { period: 50, color: "#5ab8c8" },
                bbands: {
                  period: 20,
                  stdDev: 2,
                  upperColor: "rgba(120, 180, 220, 0.45)",
                  midColor: "rgba(120, 180, 220, 0.7)",
                  lowerColor: "rgba(120, 180, 220, 0.45)",
                },
              }}
            />
          </section>
        </ErrorBoundary>

        <aside className="space-y-4">
          <section className="glass-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {comparisonTitle}
              </h2>
              <GitCompare size={16} style={{ color: "var(--accent)" }} />
            </div>
            <PerformanceChart
              data={snapshot.data?.relativePerformance ?? []}
              comparisonData={compare?.relativePerformance}
              height={220}
              seriesName={primarySymbol}
              comparisonName={activeCompareSymbol ?? "Benchmark"}
            />
            <div className="mt-3 divide-y text-xs" style={{ borderColor: "var(--border)" }}>
              <EvidenceRow
                label={`${primarySymbol} return`}
                value={formatMaybePercent(summary?.returnPct)}
              />
              <EvidenceRow
                label={activeCompareSymbol ? `${activeCompareSymbol} return` : "Comparison return"}
                value={formatMaybePercent(compare?.summary.returnPct)}
              />
              <EvidenceRow
                label="Return spread"
                value={formatMaybePercent(
                  relativeSpread(summary?.returnPct, compare?.summary.returnPct)
                )}
              />
              <EvidenceRow
                label="Compare coverage"
                value={
                  compareCoverage
                    ? `${formatNumber(compareCoverage.completeness, 2)}% / ${compareCoverage.totalCandles.toLocaleString()} bars`
                    : "—"
                }
              />
              <EvidenceRow label="Compare freshness" value={formatAge(compareFreshnessMs)} />
            </div>
          </section>

          <section className="glass-panel p-4">
            <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Candle Evidence
            </h2>
            <div className="mt-3 divide-y text-xs" style={{ borderColor: "var(--border)" }}>
              <EvidenceRow label="Exchange" value={selectedExchange.toUpperCase()} />
              <EvidenceRow label="Source" value="Signal Harvester" />
              <EvidenceRow label="Timeframe" value={timeframe} />
              <EvidenceRow label="First candle" value={formatMaybeDate(coverage?.earliest)} />
              <EvidenceRow label="Latest candle" value={formatMaybeDate(coverage?.latest)} />
              <EvidenceRow label="Gaps" value={(coverage?.gapCount ?? 0).toLocaleString()} />
              <EvidenceRow label="Avg volume" value={formatMaybeCompact(summary?.averageVolume)} />
              <EvidenceRow
                label="Realized vol"
                value={formatMaybePercent(summary?.volatilityPct, false)}
              />
            </div>
          </section>

          <section className="glass-panel p-4">
            <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Launchpad
            </h2>
            <div className="mt-3 grid gap-2">
              <Link
                href={`/research?symbol=${encodeURIComponent(primarySymbol)}&timeframe=${timeframe}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
              >
                <ShieldCheck size={15} />
                Research leaderboard
              </Link>
              <Link
                href={`/backtest?symbol=${encodeURIComponent(primarySymbol)}&exchange=${selectedExchange}&timeframe=${timeframe}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
              >
                <FlaskConical size={15} />
                Manual backtest
              </Link>
              <Link
                href={`/bots/new?symbol=${encodeURIComponent(primarySymbol)}&exchange=${selectedExchange}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <Bot size={15} />
                Paper bot draft
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-xs uppercase tracking-[0.16em]"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
        <Icon size={15} style={{ color: "var(--accent)" }} />
      </div>
      <div className="mt-3 text-xl tabular-nums" style={{ color: tone ?? "var(--text-primary)" }}>
        {value}
      </div>
      {detail && (
        <div className="mt-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-2"
      style={{ borderColor: "var(--border)" }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

const selectStyle = {
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
};

function formatMaybePercent(value: number | null | undefined, signed = true) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return signed ? formatPercent(value, 2) : `${formatNumber(value, 2)}%`;
}

function formatMaybeCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return formatCurrency(value);
}

function formatMaybeCompact(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return formatCompact(value);
}

function formatMaybeDate(value: string | null | undefined) {
  return value ? formatDateShort(value) : "—";
}

function formatAge(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function relativeSpread(primary: number | null | undefined, comparison: number | null | undefined) {
  if (primary === null || primary === undefined) return null;
  if (comparison === null || comparison === undefined) return primary;
  return primary - comparison;
}
