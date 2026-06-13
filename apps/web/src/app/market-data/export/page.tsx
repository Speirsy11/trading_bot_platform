"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  FileArchive,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { toast } from "@/components/ui/Toaster";
import { formatDateShort, formatNumber } from "@/lib/format";
import { trpc } from "@/lib/trpc";

const CANONICAL_TIMEFRAMES = ["1m", "15m", "1h", "4h"] as const;
type ExportTimeframe = (typeof CANONICAL_TIMEFRAMES)[number];
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

export default function ExportPage() {
  const utils = trpc.useUtils();
  const [exchange, setExchange] = useState("binance");
  const [symbolsText, setSymbolsText] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState<ExportTimeframe>("1h");
  const [format, setFormat] = useState<"csv" | "parquet" | "sqlite">("csv");
  const [compress, setCompress] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeExportId, setActiveExportId] = useState<string | null>(null);

  const parsedSymbols = useMemo(() => parseSymbols(symbolsText), [symbolsText]);
  const exportsQuery = trpc.dataExport.list.useQuery({ limit: 10 }, { refetchInterval: 10_000 });
  const activeStatus = trpc.dataExport.getStatus.useQuery(
    { exportId: activeExportId ?? "" },
    { enabled: Boolean(activeExportId), refetchInterval: activeExportId ? 2500 : false }
  );

  const exportMutation = trpc.dataExport.create.useMutation({
    onSuccess: async (data) => {
      setActiveExportId(data.exportId);
      toast.success("Export queued");
      await utils.dataExport.list.invalidate();
    },
    onError: (error) => toast.error(`Export failed: ${error.message}`),
  });

  useEffect(() => {
    const now = Date.now();
    setStartDate((value) => value || dateInput(now - 90 * 86_400_000));
    setEndDate((value) => value || dateInput(now));
  }, []);

  const handleExport = () => {
    if (parsedSymbols.length === 0) {
      toast.error("At least one symbol is required.");
      return;
    }

    const invalidSymbol = parsedSymbols.find((value) => !value.includes("/"));
    if (invalidSymbol) {
      toast.error(`${invalidSymbol} must use BASE/QUOTE format.`);
      return;
    }

    const startTime = Date.parse(`${startDate}T00:00:00.000Z`);
    const endTime = Date.parse(`${endDate}T23:59:59.999Z`);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
      toast.error("Choose a valid export date range.");
      return;
    }

    setSymbolsText(parsedSymbols.join(", "));
    exportMutation.mutate({
      exchange,
      symbols: parsedSymbols,
      timeframe,
      format,
      compress,
      startTime,
      endTime,
    });
  };

  const currentStatus = activeStatus.data;
  const progress = clampProgress(currentStatus?.progress ?? 0);

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/market-data"
            className="mb-3 inline-flex items-center gap-2 text-sm"
            style={{ color: "var(--accent)" }}
          >
            <ArrowLeft size={15} />
            Market data
          </Link>
          <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
            Export Data
          </h1>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
            Stream raw 1m candles or native Harvester rollups for the Binance top-10 research
            universe.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportsQuery.refetch()}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="glass-panel space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Exchange" htmlFor="export-exchange">
              <select
                id="export-exchange"
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              >
                <option value="binance">Binance</option>
                <option value="bybit">Bybit</option>
                <option value="kraken">Kraken</option>
              </select>
            </Field>

            <Field label="Symbols" htmlFor="export-symbols">
              <div className="flex gap-2">
                <input
                  id="export-symbols"
                  type="text"
                  value={symbolsText}
                  onChange={(e) => setSymbolsText(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setSymbolsText(TOP_SYMBOLS.join(", "))}
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Top 10
                </button>
              </div>
            </Field>

            <Field label="Timeframe" htmlFor="export-timeframe">
              <div className="space-y-1.5">
                <select
                  id="export-timeframe"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as ExportTimeframe)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                >
                  {CANONICAL_TIMEFRAMES.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf}
                    </option>
                  ))}
                </select>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  1m raw candles plus native 15m, 1h, and 4h rollups.
                </p>
              </div>
            </Field>

            <Field label="Format" htmlFor="export-format">
              <select
                id="export-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as "csv" | "parquet" | "sqlite")}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              >
                <option value="csv">CSV</option>
                <option value="parquet">Parquet</option>
                <option value="sqlite">SQLite</option>
              </select>
            </Field>

            <Field label="Start" htmlFor="export-start">
              <input
                id="export-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
            </Field>

            <Field label="End" htmlFor="export-end">
              <input
                id="export-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              <input
                type="checkbox"
                checked={compress}
                onChange={(e) => setCompress(e.target.checked)}
                className="rounded"
              />
              Gzip compression
            </label>

            <button
              type="button"
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
            >
              <Play size={16} />
              {exportMutation.isPending ? "Queueing..." : "Queue export"}
            </button>
          </div>
        </div>

        <div className="glass-panel space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
                Active Export
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {activeExportId ? shortId(activeExportId) : "No queued export selected"}
              </p>
            </div>
            <StatusBadge status={currentStatus?.status ?? "idle"} />
          </div>

          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: "var(--bg-input)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: statusColor(currentStatus?.status) }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <Metric label="Progress" value={`${progress}%`} />
            <Metric label="Status" value={currentStatus?.status ?? "idle"} />
            <Metric label="Download" value={currentStatus?.downloadUrl ? "ready" : "pending"} />
          </div>

          {currentStatus?.downloadUrl && (
            <a
              href={currentStatus.downloadUrl}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <Download size={16} />
              Download file
            </a>
          )}

          {currentStatus?.error && (
            <p className="text-sm" style={{ color: "var(--loss)" }}>
              {currentStatus.error}
            </p>
          )}
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
            Recent Exports
          </h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {(exportsQuery.data?.items.length ?? 0).toLocaleString()} rows
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th className="py-2 pr-4 text-left">Created</th>
                <th className="py-2 pr-4 text-left">Symbols</th>
                <th className="py-2 pr-4 text-left">Timeframe</th>
                <th className="py-2 pr-4 text-left">Format</th>
                <th className="py-2 pr-4 text-right">Rows</th>
                <th className="py-2 pr-4 text-right">Size</th>
                <th className="py-2 pr-4 text-left">Status</th>
                <th className="py-2 text-right">File</th>
              </tr>
            </thead>
            <tbody>
              {(exportsQuery.data?.items ?? []).map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-3 pr-4" style={{ color: "var(--text-muted)" }}>
                    {item.createdAt ? formatDateShort(item.createdAt) : "-"}
                  </td>
                  <td className="py-3 pr-4" style={{ color: "var(--text-primary)" }}>
                    {(item.symbols as string[]).join(", ")}
                  </td>
                  <td className="py-3 pr-4" style={{ color: "var(--text-muted)" }}>
                    {item.timeframe}
                  </td>
                  <td className="py-3 pr-4" style={{ color: "var(--text-muted)" }}>
                    {item.compressed ? `${item.format}.gz` : item.format}
                  </td>
                  <td
                    className="py-3 pr-4 text-right tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.rowCount == null ? "-" : formatNumber(item.rowCount, 0)}
                  </td>
                  <td
                    className="py-3 pr-4 text-right tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatFileSize(item.fileSize)}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-3 text-right">
                    {item.downloadUrl ? (
                      <a
                        href={item.downloadUrl}
                        className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                        style={{
                          background: "var(--bg-input)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <Download size={13} />
                        Download
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveExportId(item.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                        style={{
                          background: "var(--bg-input)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <Clock3 size={13} />
                        Track
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!exportsQuery.isLoading && (exportsQuery.data?.items.length ?? 0) === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No exports queued yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {exportsQuery.isLoading && (
          <div className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Loading exports...
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 truncate text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? "idle";
  const Icon =
    label === "completed"
      ? CheckCircle2
      : label === "failed"
        ? XCircle
        : label === "processing" || label === "pending"
          ? Clock3
          : FileArchive;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
      style={{
        background: "var(--bg-input)",
        color: statusColor(label),
        border: "1px solid var(--border)",
      }}
    >
      <Icon size={13} />
      {label}
    </span>
  );
}

const inputStyle = {
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
};

function parseSymbols(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function dateInput(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), 100));
}

function statusColor(status?: string | null) {
  if (status === "completed") return "var(--profit)";
  if (status === "failed") return "var(--loss)";
  if (status === "processing" || status === "pending") return "var(--accent)";
  return "var(--text-muted)";
}

function shortId(id: string) {
  return id.slice(0, 8);
}

function formatFileSize(value: number | null | undefined) {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${formatNumber(value / 1024, 1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${formatNumber(value / (1024 * 1024), 1)} MB`;
  return `${formatNumber(value / (1024 * 1024 * 1024), 1)} GB`;
}
