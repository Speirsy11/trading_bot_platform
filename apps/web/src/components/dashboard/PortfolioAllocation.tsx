"use client";

import { PieChart } from "lucide-react";

import { PortfolioPieChart } from "@/components/charts/PortfolioPieChart";
import { trpc } from "@/lib/trpc";

export function PortfolioAllocation() {
  const { data, isLoading } = trpc.portfolio.getAllocation.useQuery();

  if (isLoading) {
    return (
      <div className="glass-panel p-5">
        <h2 className="text-lg mb-4">Portfolio Allocation</h2>
        <div
          className="animate-pulse rounded-lg"
          style={{ height: 250, background: "var(--bg-input)" }}
        />
      </div>
    );
  }

  const allocation = data ?? [];

  return (
    <div className="glass-panel p-5">
      <h2 className="text-lg mb-4">Portfolio Allocation</h2>

      {allocation.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-12 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <PieChart size={24} />
          <p className="text-sm">No allocation data. Add bots with balances to see breakdown.</p>
        </div>
      ) : (
        <PortfolioPieChart
          data={allocation.map((item) => ({
            name: item.exchange,
            value: item.value,
          }))}
        />
      )}
    </div>
  );
}
