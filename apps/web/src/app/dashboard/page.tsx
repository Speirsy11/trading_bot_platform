"use client";

import { Suspense } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BotStatusCards } from "@/components/dashboard/BotStatusCards";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { PortfolioAllocation } from "@/components/dashboard/PortfolioAllocation";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { RecentTrades } from "@/components/dashboard/RecentTrades";

function LoadingPanel() {
  return (
    <div
      className="glass-panel flex items-center justify-center p-8"
      style={{ color: "var(--text-muted)" }}
    >
      <div className="animate-pulse text-sm">Loading…</div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
        Dashboard
      </h1>

      <ErrorBoundary>
        <Suspense fallback={<LoadingPanel />}>
          <PortfolioSummary />
        </Suspense>
      </ErrorBoundary>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ErrorBoundary>
            <Suspense fallback={<LoadingPanel />}>
              <BotStatusCards />
            </Suspense>
          </ErrorBoundary>

          <ErrorBoundary>
            <Suspense fallback={<LoadingPanel />}>
              <MarketOverview />
            </Suspense>
          </ErrorBoundary>
        </div>

        <div className="space-y-6">
          <ErrorBoundary>
            <Suspense fallback={<LoadingPanel />}>
              <RecentTrades />
            </Suspense>
          </ErrorBoundary>

          <ErrorBoundary>
            <Suspense fallback={<LoadingPanel />}>
              <PortfolioAllocation />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
