"use client";

import { Suspense, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BotStatusCards } from "@/components/dashboard/BotStatusCards";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { PortfolioAllocation } from "@/components/dashboard/PortfolioAllocation";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { useUiStore } from "@/stores/ui";

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

const WIDGET_LABELS: Record<string, string> = {
  portfolio: "Portfolio Summary",
  bots: "Bot Status",
  market: "Market Overview",
  trades: "Recent Trades",
  allocation: "Portfolio Allocation",
};

const ALL_WIDGET_IDS = ["portfolio", "bots", "market", "trades", "allocation"];

function WidgetPanel({ id }: { id: string }) {
  const content = (() => {
    switch (id) {
      case "portfolio":
        return <PortfolioSummary />;
      case "bots":
        return <BotStatusCards />;
      case "market":
        return <MarketOverview />;
      case "trades":
        return <RecentTrades />;
      case "allocation":
        return <PortfolioAllocation />;
      default:
        return null;
    }
  })();

  if (!content) return null;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingPanel />}>{content}</Suspense>
    </ErrorBoundary>
  );
}

export default function DashboardPage() {
  const { dashboardWidgets, setDashboardWidgets } = useUiStore();
  const [customizing, setCustomizing] = useState(false);

  function moveWidget(index: number, direction: -1 | 1) {
    const next = [...dashboardWidgets];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const a = next[index] as string;
    const b = next[target] as string;
    next[index] = b;
    next[target] = a;
    setDashboardWidgets(next);
  }

  function toggleWidget(id: string) {
    if (dashboardWidgets.includes(id)) {
      if (dashboardWidgets.length === 1) return; // keep at least one
      setDashboardWidgets(dashboardWidgets.filter((w) => w !== id));
    } else {
      setDashboardWidgets([...dashboardWidgets, id]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl" style={{ color: "var(--text-primary)" }}>
          Dashboard
        </h1>
        <button
          onClick={() => setCustomizing((v) => !v)}
          className="rounded px-3 py-1 text-sm"
          style={{
            background: customizing
              ? "var(--accent, #6366f1)"
              : "var(--surface-2, rgba(255,255,255,0.08))",
            color: "var(--text-primary)",
            border: "1px solid var(--border, rgba(255,255,255,0.1))",
          }}
        >
          {customizing ? "Done" : "Customize"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {dashboardWidgets.map((id) => (
          <WidgetPanel key={id} id={id} />
        ))}
      </div>

      {customizing && (
        <div
          className="rounded-lg p-4 space-y-3"
          style={{
            background: "var(--surface-2, rgba(255,255,255,0.05))",
            border: "1px solid var(--border, rgba(255,255,255,0.1))",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Widget order &amp; visibility
          </p>
          <div className="space-y-2">
            {dashboardWidgets.map((id, index) => (
              <div
                key={id}
                className="flex items-center gap-2 rounded px-3 py-2"
                style={{ background: "var(--surface-1, rgba(255,255,255,0.04))" }}
              >
                <span className="flex-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  {WIDGET_LABELS[id] ?? id}
                </span>
                <button
                  onClick={() => moveWidget(index, -1)}
                  disabled={index === 0}
                  className="px-1.5 py-0.5 text-xs rounded disabled:opacity-30"
                  style={{
                    background: "var(--surface-3, rgba(255,255,255,0.08))",
                    color: "var(--text-secondary, #aaa)",
                  }}
                  aria-label={`Move ${WIDGET_LABELS[id] ?? id} up`}
                >
                  ↑
                </button>
                <button
                  onClick={() => moveWidget(index, 1)}
                  disabled={index === dashboardWidgets.length - 1}
                  className="px-1.5 py-0.5 text-xs rounded disabled:opacity-30"
                  style={{
                    background: "var(--surface-3, rgba(255,255,255,0.08))",
                    color: "var(--text-secondary, #aaa)",
                  }}
                  aria-label={`Move ${WIDGET_LABELS[id] ?? id} down`}
                >
                  ↓
                </button>
                <button
                  onClick={() => toggleWidget(id)}
                  className="px-1.5 py-0.5 text-xs rounded"
                  style={{
                    background: "var(--surface-3, rgba(255,255,255,0.08))",
                    color: "var(--text-danger, #f87171)",
                  }}
                  aria-label={`Remove ${WIDGET_LABELS[id] ?? id}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {ALL_WIDGET_IDS.filter((id) => !dashboardWidgets.includes(id)).length > 0 && (
            <div
              className="pt-2 border-t"
              style={{ borderColor: "var(--border, rgba(255,255,255,0.1))" }}
            >
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                Add widget
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_WIDGET_IDS.filter((id) => !dashboardWidgets.includes(id)).map((id) => (
                  <button
                    key={id}
                    onClick={() => toggleWidget(id)}
                    className="px-2 py-1 text-xs rounded"
                    style={{
                      background: "var(--surface-3, rgba(255,255,255,0.08))",
                      color: "var(--text-secondary, #aaa)",
                      border: "1px solid var(--border, rgba(255,255,255,0.1))",
                    }}
                  >
                    + {WIDGET_LABELS[id] ?? id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
