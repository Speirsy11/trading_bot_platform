"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { formatCompact, formatDateShort, formatNumber } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const TIMEFRAMES = ["1m", "15m", "1h", "4h"];
const RESEARCH_SYMBOLS = [
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
const RESEARCH_TIMEFRAMES = ["15m", "1h", "4h"];

type QualityMetric = {
  exchange: string;
  symbol: string;
  timeframe: string;
  totalCandles: number;
  gapCount: number;
  latest: string | null;
  missingCandles: number;
  completenessPct: string;
  lastUpdated: string | null;
  status: string;
};

export default function MarketDataPage() {
  const [exchange, setExchange] = useState("binance");
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1h");
  const [previewSymbol, setPreviewSymbol] = useState("");

  const { data: symbols } = trpc.market.getSymbols.useQuery(
    { exchange, collectedOnly: true },
    { enabled: !!exchange }
  );

  const { data: qualityMetrics } = trpc.dataCollection.getQualityMetrics.useQuery({});
  const readiness = trpc.research.getDataReadiness.useQuery(
    { exchange },
    { refetchInterval: 30_000 }
  );
  const queueStats = trpc.dataCollection.queueStats.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const { data: candles } = trpc.market.getCandles.useQuery(
    { exchange, symbol: previewSymbol, timeframe },
    { enabled: !!previewSymbol }
  );

  const filteredSymbols = symbols?.filter(
    (s: string) => !symbol || s.toLowerCase().includes(symbol.toLowerCase())
  );
  const qualitySummary = useMemo(
    () => summarizeQualityMetrics((qualityMetrics ?? []) as QualityMetric[]),
    [qualityMetrics]
  );
  const readinessByKey = useMemo(() => {
    const rows = readiness.data?.items ?? [];
    return new Map(rows.map((item) => [`${item.symbol}-${item.timeframe}`, item]));
  }, [readiness.data?.items]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
            Signal Harvester
          </p>
          <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
            Market data confidence
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
            Audit the canonical candle source used by charts, exports, backtests, paper bots, and
            research sweeps.
          </p>
        </div>
        <Link
          href="/market-data/export"
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
        >
          <Download size={16} />
          Export Data
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatusCard
          icon={ShieldCheck}
          label="Research Rollups"
          value={
            readiness.data
              ? `${readiness.data.readyCount}/${readiness.data.total}`
              : readiness.isLoading
                ? "checking"
                : "unknown"
          }
          detail={
            readiness.data?.ready
              ? "Top-10 15m, 1h, 4h ready"
              : `${readiness.data?.blockingCount ?? 0} blocking research sweep`
          }
          tone={readiness.data?.ready ? "var(--profit)" : "var(--accent)"}
        />
        <StatusCard
          icon={Database}
          label="Candle Rows"
          value={qualitySummary.totalCandles > 0 ? formatCompact(qualitySummary.totalCandles) : "0"}
          detail={`${qualitySummary.symbolCount} symbols across ${qualitySummary.timeframeCount} intervals`}
        />
        <StatusCard
          icon={Clock}
          label="Freshness"
          value={qualitySummary.latest ? formatAge(qualitySummary.latest) : "n/a"}
          detail={qualitySummary.latest ? formatDateShort(qualitySummary.latest) : "No latest row"}
        />
        <StatusCard
          icon={Activity}
          label="Worst Complete"
          value={
            qualitySummary.worstCompleteness === null
              ? "n/a"
              : `${formatNumber(qualitySummary.worstCompleteness, 2)}%`
          }
          detail={`${qualitySummary.missingCandles.toLocaleString()} missing candles estimated`}
          tone={
            qualitySummary.worstCompleteness !== null && qualitySummary.worstCompleteness < 95
              ? "var(--loss)"
              : "var(--text-primary)"
          }
        />
        <StatusCard
          icon={AlertTriangle}
          label="Gaps"
          value={qualitySummary.gapCount.toLocaleString()}
          detail="Reported by the market data reader"
          tone={qualitySummary.gapCount > 0 ? "var(--loss)" : "var(--profit)"}
        />
        <StatusCard
          icon={RefreshCw}
          label="Export Queue"
          value={String(queueStats.data?.export?.waiting ?? 0)}
          detail={`${queueStats.data?.export?.active ?? 0} active, ${queueStats.data?.export?.failed ?? 0} failed`}
          tone={(queueStats.data?.export?.failed ?? 0) > 0 ? "var(--loss)" : "var(--text-primary)"}
        />
      </div>

      <div className="glass-panel p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Top-10 native rollup readiness
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              These are the exact Harvester rollups required by the research leaderboard.
            </p>
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {readiness.data?.latestUpdated
              ? `Updated ${formatAge(new Date(readiness.data.latestUpdated))}`
              : readiness.isLoading
                ? "Checking Signal Harvester..."
                : "No readiness update"}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th
                  className="sticky left-0 py-2 pr-4 text-left font-normal"
                  style={{ background: "var(--bg-card)" }}
                >
                  Symbol
                </th>
                {RESEARCH_TIMEFRAMES.map((tf) => (
                  <th key={tf} className="py-2 pr-4 text-left font-normal">
                    {tf}
                  </th>
                ))}
                <th className="py-2 pr-4 text-right font-normal">Lagging Latest</th>
                <th className="py-2 text-right font-normal">Rows</th>
              </tr>
            </thead>
            <tbody>
              {RESEARCH_SYMBOLS.map((researchSymbol) => {
                const items = RESEARCH_TIMEFRAMES.map((tf) =>
                  readinessByKey.get(`${researchSymbol}-${tf}`)
                );
                const latest = minDate(items.map((item) => item?.latest ?? null));
                const rows = items.reduce((sum, item) => sum + (item?.totalCandles ?? 0), 0);
                return (
                  <tr key={researchSymbol} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td
                      className="sticky left-0 py-2 pr-4 font-medium"
                      style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
                    >
                      {researchSymbol}
                    </td>
                    {RESEARCH_TIMEFRAMES.map((tf) => {
                      const item = readinessByKey.get(`${researchSymbol}-${tf}`);
                      return (
                        <td key={tf} className="py-2 pr-4">
                          <ReadinessPill status={item?.status ?? "missing"} />
                        </td>
                      );
                    })}
                    <td
                      className="py-2 pr-4 text-right tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {latest ? formatAge(latest) : "n/a"}
                    </td>
                    <td
                      className="py-2 text-right tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {rows.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Exchange
            </label>
            <select
              value={exchange}
              onChange={(e) => {
                setExchange(e.target.value);
                setPreviewSymbol("");
              }}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <option value="binance">Binance</option>
              <option value="bybit">Bybit</option>
              <option value="kraken">Kraken</option>
            </select>
          </div>

          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Search Symbol
            </label>
            <input
              type="text"
              placeholder="e.g. BTC/USDT"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Timeframe
            </label>
            <div className="flex gap-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className="px-3 py-2 text-xs rounded-lg transition-colors"
                  style={{
                    color: tf === timeframe ? "var(--accent)" : "var(--text-muted)",
                    background: tf === timeframe ? "var(--accent-dim)" : "var(--bg-input)",
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Symbol List */}
        <div className="glass-panel p-4 max-h-[600px] overflow-y-auto">
          <h3
            className="text-xs font-medium mb-3 sticky top-0 pb-2"
            style={{ color: "var(--text-muted)", background: "var(--bg-card)" }}
          >
            Symbols ({filteredSymbols?.length ?? 0})
          </h3>
          <div className="space-y-1">
            {filteredSymbols?.map((s: string) => (
              <button
                key={s}
                onClick={() => setPreviewSymbol(s)}
                className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: previewSymbol === s ? "var(--accent-dim)" : "transparent",
                  color: previewSymbol === s ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                <span>{s}</span>
              </button>
            ))}
            {filteredSymbols?.length === 0 && (
              <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
                No symbols found
              </p>
            )}
          </div>
        </div>

        {/* Preview Chart */}
        <div className="lg:col-span-2 glass-panel p-4">
          {previewSymbol ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {previewSymbol} - {timeframe}
                </h3>
                {candles && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {candles.length} candles loaded
                  </span>
                )}
              </div>
              <CandlestickChart
                data={candles ?? []}
                height={450}
                showVolume
                showIndicatorControls
              />
            </>
          ) : (
            <div
              className="flex items-center justify-center h-[450px] text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Select a symbol to preview chart data
            </div>
          )}
        </div>
      </div>

      {/* Data Quality */}
      <div className="glass-panel p-4">
        <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
          Data Quality
        </h2>
        {qualityMetrics && qualityMetrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left py-2 pr-4">Exchange</th>
                  <th className="text-left py-2 pr-4">Symbol</th>
                  <th className="text-left py-2 pr-4">Timeframe</th>
                  <th className="text-right py-2 pr-4">Candles</th>
                  <th className="text-right py-2 pr-4">Gaps</th>
                  <th className="text-right py-2 pr-4">Complete</th>
                  <th className="text-right py-2 pr-4">Missing</th>
                  <th className="text-left py-2 pr-4">Last Updated</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {qualityMetrics.map((row) => {
                  const completeness = Number.parseFloat(row.completenessPct);
                  const completionColor =
                    completeness >= 99
                      ? "var(--profit)"
                      : completeness >= 95
                        ? "var(--accent)"
                        : "var(--loss)";
                  return (
                    <tr
                      key={`${row.exchange}-${row.symbol}-${row.timeframe}`}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                        {row.exchange}
                      </td>
                      <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>
                        {row.symbol}
                      </td>
                      <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>
                        {row.timeframe}
                      </td>
                      <td
                        className="py-2 pr-4 text-right tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {row.totalCandles.toLocaleString()}
                      </td>
                      <td
                        className="py-2 pr-4 text-right tabular-nums"
                        style={{ color: row.gapCount > 0 ? "var(--danger)" : "var(--text-muted)" }}
                      >
                        {row.gapCount}
                      </td>
                      <td
                        className="py-2 pr-4 text-right tabular-nums"
                        style={{ color: completionColor }}
                      >
                        {row.completenessPct}%
                      </td>
                      <td
                        className="py-2 pr-4 text-right tabular-nums"
                        style={{
                          color: row.missingCandles > 0 ? "var(--loss)" : "var(--text-muted)",
                        }}
                      >
                        {row.missingCandles.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>
                        {row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : "—"}
                      </td>
                      <td className="py-2">
                        <span
                          className="px-2 py-0.5 rounded text-xs"
                          style={{
                            background:
                              row.status === "collecting" || row.status === "running"
                                ? "var(--accent-dim)"
                                : row.status === "error" || row.status === "failed"
                                  ? "rgba(var(--danger-rgb),0.15)"
                                  : "var(--bg-input)",
                            color:
                              row.status === "collecting" || row.status === "running"
                                ? "var(--accent)"
                                : row.status === "error" || row.status === "failed"
                                  ? "var(--danger)"
                                  : "var(--text-muted)",
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
            No collection data available
          </p>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="glass-panel p-4">
      <Icon size={20} style={{ color: "var(--accent)" }} />
      <div
        className="mt-3 text-xs uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div className="mt-1 text-xl tabular-nums" style={{ color: tone ?? "var(--text-primary)" }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {detail}
      </div>
    </div>
  );
}

function ReadinessPill({ status }: { status: string }) {
  const config = readinessPillConfig(status);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1"
      style={{
        background: config.background,
        color: config.color,
        border: config.border,
      }}
    >
      {config.icon}
      {status}
    </span>
  );
}

function readinessPillConfig(status: string): {
  background: string;
  color: string;
  border: string;
  icon: ReactNode;
} {
  if (status === "ready") {
    return {
      background: "rgba(110, 231, 160, 0.10)",
      color: "var(--profit)",
      border: "1px solid rgba(110, 231, 160, 0.20)",
      icon: <CheckCircle2 size={12} />,
    };
  }
  if (status === "running") {
    return {
      background: "var(--accent-dim)",
      color: "var(--accent)",
      border: "1px solid rgba(200, 165, 90, 0.24)",
      icon: <RefreshCw size={12} />,
    };
  }
  return {
    background: "rgba(248, 113, 113, 0.10)",
    color: "var(--loss)",
    border: "1px solid rgba(248, 113, 113, 0.22)",
    icon: <AlertTriangle size={12} />,
  };
}

function summarizeQualityMetrics(rows: QualityMetric[]) {
  const totalCandles = rows.reduce((sum, row) => sum + row.totalCandles, 0);
  const latest = maxDate(rows.map((row) => row.latest));
  const symbolCount = new Set(rows.map((row) => row.symbol)).size;
  const timeframeCount = new Set(rows.map((row) => row.timeframe)).size;
  const completenessValues = rows
    .map((row) => Number.parseFloat(row.completenessPct))
    .filter(Number.isFinite);

  return {
    totalCandles,
    latest,
    symbolCount,
    timeframeCount,
    gapCount: rows.reduce((sum, row) => sum + row.gapCount, 0),
    missingCandles: rows.reduce((sum, row) => sum + row.missingCandles, 0),
    worstCompleteness: completenessValues.length > 0 ? Math.min(...completenessValues) : null,
  };
}

function maxDate(values: Array<string | null | undefined>) {
  const times = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter(Number.isFinite);
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

function minDate(values: Array<string | null | undefined>) {
  const times = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter(Number.isFinite);
  return times.length > 0 ? new Date(Math.min(...times)) : null;
}

function formatAge(date: Date) {
  const ageMs = Math.max(Date.now() - date.getTime(), 0);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
