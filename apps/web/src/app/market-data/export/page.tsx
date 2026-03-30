"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc";

export default function ExportPage() {
  const [exchange, setExchange] = useState("binance");
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [format, setFormat] = useState<"csv" | "parquet" | "sqlite">("csv");
  const [compress, setCompress] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const exportMutation = trpc.dataExport.create.useMutation({
    onMutate: () => setExporting(true),
    onSettled: () => setExporting(false),
    onSuccess: () => setValidationError(null),
  });

  const handleExport = () => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) {
      setValidationError("Symbol is required.");
      return;
    }

    if (!normalizedSymbol.includes("/")) {
      setValidationError("Symbol must use BASE/QUOTE format.");
      return;
    }

    setValidationError(null);
    setSymbol(normalizedSymbol);
    exportMutation.mutate({
      exchange,
      symbols: [normalizedSymbol],
      timeframe,
      format,
      compress,
      startTime: Date.now() - 90 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
        Export Data
      </h1>

      <div className="glass-panel p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label
              htmlFor="export-exchange"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Exchange
            </label>
            <select
              id="export-exchange"
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
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

          <div className="space-y-1">
            <label
              htmlFor="export-symbol"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Symbol
            </label>
            <input
              id="export-symbol"
              type="text"
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
            <label
              htmlFor="export-timeframe"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Timeframe
            </label>
            <select
              id="export-timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="export-format"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Format
            </label>
            <select
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "csv" | "parquet" | "sqlite")}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <option value="csv">CSV</option>
              <option value="parquet">Parquet</option>
              <option value="sqlite">SQLite</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
          <input
            type="checkbox"
            checked={compress}
            onChange={(e) => setCompress(e.target.checked)}
            className="rounded"
          />
          Compress output (gzip)
        </label>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="rounded-lg px-6 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
        >
          {exporting ? "Exporting…" : "Export"}
        </button>

        {validationError && (
          <p className="text-sm" style={{ color: "var(--loss)" }}>
            {validationError}
          </p>
        )}

        {exportMutation.isSuccess && (
          <p className="text-sm" style={{ color: "var(--profit)" }}>
            Export complete. Check your downloads.
          </p>
        )}
        {exportMutation.isError && (
          <p className="text-sm" style={{ color: "var(--loss)" }}>
            Export failed: {exportMutation.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
