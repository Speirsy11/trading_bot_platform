"use client";

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Bot, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/lib/trpc";

export default function BotsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: bots, isLoading } = trpc.bots.list.useQuery({
    status:
      statusFilter === "all"
        ? undefined
        : (statusFilter as "running" | "paused" | "stopped" | "error"),
  });

  const botList = bots ?? [];
  type BotRow = (typeof botList)[number];

  const columns: ColumnDef<BotRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link
          href={`/bots/${row.original.id}`}
          className="font-medium transition-colors"
          style={{ color: "var(--accent)" }}
        >
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "strategy", header: "Strategy" },
    { accessorKey: "exchange", header: "Exchange" },
    { accessorKey: "symbol", header: "Symbol" },
    { accessorKey: "mode", header: "Mode" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const color =
          status === "running"
            ? "var(--profit)"
            : status === "error"
              ? "var(--loss)"
              : "var(--text-muted)";
        return (
          <span className="flex items-center gap-1.5 text-xs" style={{ color }}>
            <span
              className={`h-1.5 w-1.5 rounded-full bg-current ${status === "running" ? "animate-pulse" : ""}`}
            />
            {status}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Link
          href={`/bots/${row.original.id}`}
          className="text-xs transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          View →
        </Link>
      ),
    },
  ];

  const table = useReactTable({
    data: botList,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
          Bots
        </h1>
        <Link
          href="/bots/new"
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
        >
          <Plus size={16} />
          Create Bot
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 max-w-sm"
          style={{ background: "var(--bg-input)" }}
        >
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            aria-label="Search bots"
            placeholder="Search bots..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1"
            style={{ color: "var(--text-primary)" }}
          />
        </div>

        <div className="flex gap-1">
          {["all", "running", "paused", "stopped", "error"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="rounded-lg px-3 py-1.5 text-xs capitalize transition-colors"
              style={{
                background: statusFilter === s ? "var(--accent-dim)" : "transparent",
                color: statusFilter === s ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        {isLoading ? (
          <div
            className="animate-pulse p-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Loading bots…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-normal cursor-pointer select-none"
                      style={{ color: "var(--text-muted)" }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Bot
                        size={48}
                        style={{ color: "var(--text-muted)", opacity: 0.4 }}
                        className="mb-4"
                      />
                      <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                        No bots yet
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--text-muted)", opacity: 0.7 }}
                      >
                        Create your first bot to get started
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--grid)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
