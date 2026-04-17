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
import { Activity } from "lucide-react";
import { useState, useMemo } from "react";

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

export default function HistoryPage() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "executedAt", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sideFilter, setSideFilter] = useState<"" | "buy" | "sell">("");

  const { data: bots = [] } = trpc.bots.list.useQuery({});
  // Fetch trades from the first few bots (trade history is per-bot in the API)
  const botIds = (bots as { id: string }[]).slice(0, 10).map((b) => b.id);
  const tradeQueries = trpc.useQueries((t) =>
    botIds.map((botId) => t.bots.getTrades({ botId, limit: 50 }))
  );
  const allTrades = tradeQueries.filter((q) => q.data).flatMap((q) => q.data ?? []);

  const filtered = useMemo(() => {
    if (!sideFilter) return allTrades;
    return allTrades.filter((t: Trade) => t.side === sideFilter);
  }, [allTrades, sideFilter]);

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
    onGlobalFilterChange: setGlobalFilter,
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
        <input
          type="text"
          placeholder="Search trades…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none min-w-[200px]"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        />
        <div className="flex gap-1">
          {(["", "buy", "sell"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSideFilter(s)}
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
      </div>

      {/* Table */}
      <div className="glass-panel overflow-x-auto">
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
