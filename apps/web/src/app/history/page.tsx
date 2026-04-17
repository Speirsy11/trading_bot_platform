"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Activity, ChevronDown, X } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useMemo, useEffect, useRef } from "react";

import { formatCurrency, formatDateShort, pnlColor } from "@/lib/format";
import { trpc } from "@/lib/trpc";

interface Trade {
  id: string;
  botId: string;
  symbol: string;
  side: string;
  type: string;
  price: number;
  amount: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  fee: number;
  feeCurrency: string | null;
  orderId: string | null;
  reason: string | null;
  executedAt: string;
  createdAt: string | null;
}

interface FilterPreset {
  name: string;
  q: string;
  side: "" | "buy" | "sell";
  symbol: string;
}

const PRESETS_KEY = "history-filter-presets";

const BUILTIN_PRESETS: FilterPreset[] = [
  { name: "All trades", q: "", side: "", symbol: "" },
  { name: "Buy only", q: "", side: "buy", symbol: "" },
  { name: "Sell only", q: "", side: "sell", symbol: "" },
];

function loadUserPresets(): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as FilterPreset[]) : [];
  } catch {
    return [];
  }
}

function saveUserPresets(presets: FilterPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export default function HistoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read filter state from URL
  const globalFilter = searchParams.get("q") ?? "";
  const sideFilter = (searchParams.get("side") ?? "") as "" | "buy" | "sell";
  const symbolFilter = searchParams.get("symbol") ?? "";

  const [sorting, setSorting] = useState<SortingState>([{ id: "executedAt", desc: true }]);

  // Preset UI state
  const [userPresets, setUserPresets] = useState<FilterPreset[]>([]);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const presetNameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load persisted presets on mount
  useEffect(() => {
    setUserPresets(loadUserPresets());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPresetDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus preset name input when it appears
  useEffect(() => {
    if (savingPreset) {
      presetNameInputRef.current?.focus();
    }
  }, [savingPreset]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function applyPreset(preset: FilterPreset) {
    const params = new URLSearchParams();
    if (preset.q) params.set("q", preset.q);
    if (preset.side) params.set("side", preset.side);
    if (preset.symbol) params.set("symbol", preset.symbol);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setPresetDropdownOpen(false);
  }

  function handleSavePreset() {
    const name = presetName.trim();
    if (!name) return;
    const preset: FilterPreset = { name, q: globalFilter, side: sideFilter, symbol: symbolFilter };
    const updated = [...userPresets.filter((p) => p.name !== name), preset];
    setUserPresets(updated);
    saveUserPresets(updated);
    setPresetName("");
    setSavingPreset(false);
  }

  function deletePreset(name: string) {
    const updated = userPresets.filter((p) => p.name !== name);
    setUserPresets(updated);
    saveUserPresets(updated);
  }

  const {
    data: bots = [],
    isError: isBotsError,
    refetch: refetchBots,
  } = trpc.bots.list.useQuery({});
  const botIds = (bots as { id: string }[]).slice(0, 10).map((b) => b.id);
  const tradeQueries = trpc.useQueries((t) =>
    botIds.map((botId) => t.bots.getTrades({ botId, limit: 50 }))
  );
  const isTradesError = tradeQueries.some((q) => q.isError);
  const allTrades = tradeQueries.filter((q) => q.data).flatMap((q) => q.data ?? []);

  const filtered = useMemo(() => {
    let result = allTrades;
    if (sideFilter) result = result.filter((t: Trade) => t.side === sideFilter);
    if (symbolFilter)
      result = result.filter((t: Trade) =>
        t.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
      );
    return result;
  }, [allTrades, sideFilter, symbolFilter]);

  const columns = useMemo<ColumnDef<Trade>[]>(
    () => [
      {
        accessorKey: "executedAt",
        header: "Date",
        cell: ({ getValue }) => formatDateShort(getValue() as string),
      },
      { accessorKey: "symbol", header: "Symbol" },
      { accessorKey: "botId", header: "Bot" },
      {
        accessorKey: "side",
        header: "Side",
        cell: ({ getValue }) => {
          const side = getValue() as string;
          return (
            <span
              className="uppercase text-xs font-medium"
              style={{ color: side === "buy" ? "var(--profit)" : "var(--loss)" }}
            >
              {side}
            </span>
          );
        },
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ getValue }) => formatCurrency(getValue() as number),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ getValue }) => (getValue() as number).toFixed(6),
      },
      {
        accessorKey: "pnl",
        header: "PnL",
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return (
            <span className="tabular-nums" style={{ color: pnlColor(v) }}>
              {v >= 0 ? "+" : ""}
              {formatCurrency(v)}
            </span>
          );
        },
      },
      {
        accessorKey: "fee",
        header: "Fee",
        cell: ({ getValue }) => formatCurrency(getValue() as number),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filtered as Trade[],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: (val) => updateFilter("q", val as string),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const stats = useMemo(() => {
    const arr = filtered;
    const totalPnl = arr.reduce((s, t) => s + t.pnl, 0);
    const totalFees = arr.reduce((s, t) => s + t.fee, 0);
    const wins = arr.filter((t) => t.pnl > 0).length;
    return { totalPnl, totalFees, wins, total: arr.length };
  }, [filtered]);

  const allPresets = [...BUILTIN_PRESETS, ...userPresets];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
          Trade History
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <span style={{ color: "var(--text-muted)" }}>{stats.total} trades</span>
          <span className="tabular-nums" style={{ color: pnlColor(stats.totalPnl) }}>
            PnL: {stats.totalPnl >= 0 ? "+" : ""}
            {formatCurrency(stats.totalPnl)}
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            Fees: {formatCurrency(stats.totalFees)}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Text search — synced to ?q= */}
        <input
          type="text"
          placeholder="Search trades…"
          value={globalFilter}
          onChange={(e) => updateFilter("q", e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none min-w-[200px]"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        />

        {/* Symbol filter — synced to ?symbol= */}
        <input
          type="text"
          placeholder="Symbol (e.g. BTC/USDT)"
          value={symbolFilter}
          onChange={(e) => updateFilter("symbol", e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none min-w-[160px]"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        />

        {/* Side filter — synced to ?side= */}
        <div className="flex gap-1">
          {(["", "buy", "sell"] as const).map((s) => (
            <button
              key={s}
              onClick={() => updateFilter("side", s)}
              className="px-3 py-2 rounded-lg text-xs transition-colors"
              style={{
                background: sideFilter === s ? "var(--accent-dim)" : "var(--bg-input)",
                color: sideFilter === s ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {s === "" ? "All" : s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Preset dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setPresetDropdownOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
          >
            Presets
            <ChevronDown size={12} />
          </button>

          {presetDropdownOpen && (
            <div
              className="absolute left-0 top-full mt-1 z-50 min-w-[180px] rounded-lg overflow-hidden shadow-lg"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              {allPresets.map((preset) => {
                const isBuiltin = BUILTIN_PRESETS.some((b) => b.name === preset.name);
                return (
                  <div
                    key={preset.name}
                    className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors group"
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-dim)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span className="flex-1 truncate" onClick={() => applyPreset(preset)}>
                      {preset.name}
                    </span>
                    {!isBuiltin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePreset(preset.name);
                        }}
                        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--loss)" }}
                        aria-label={`Delete preset ${preset.name}`}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Save preset */}
        {savingPreset ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={presetNameInputRef}
              type="text"
              placeholder="Preset name…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
                if (e.key === "Escape") {
                  setSavingPreset(false);
                  setPresetName("");
                }
              }}
              className="rounded-lg px-3 py-2 text-xs outline-none w-[140px]"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="px-3 py-2 rounded-lg text-xs disabled:opacity-40 transition-colors"
              style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setSavingPreset(false);
                setPresetName("");
              }}
              className="px-2 py-2 rounded-lg text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSavingPreset(true)}
            className="px-3 py-2 rounded-lg text-xs transition-colors"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
          >
            Save preset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-panel overflow-x-auto">
        {(isBotsError || isTradesError) && (
          <div className="flex flex-col items-center py-12 gap-3">
            <p className="text-sm" style={{ color: "var(--loss)" }}>
              Failed to load data
            </p>
            <button
              onClick={() => void refetchBots()}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
            >
              Retry
            </button>
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="text-left px-4 py-3 text-xs font-medium cursor-pointer select-none"
                    style={{
                      color: "var(--text-muted)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="transition-colors"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-2.5 tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {table.getRowModel().rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Activity
              size={48}
              style={{ color: "var(--text-muted)", opacity: 0.4 }}
              className="mb-4"
            />
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              No trades recorded yet
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
              Trades will appear here once your bots execute orders
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex gap-1">
            <button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-30"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
            >
              Previous
            </button>
            <button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-30"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
