"use client";

import { Bell, Search, Wifi, WifiOff } from "lucide-react";

import { PnLTicker } from "@/components/layout/PnLTicker";
import { useCmdK } from "@/hooks/useCmdK";
import { useSocket } from "@/providers/SocketProvider";
import { useUiStore } from "@/stores/ui";

export function Header() {
  const selectedSymbol = useUiStore((s) => s.selectedSymbol);
  const { isConnected } = useSocket();
  const { open: openPalette } = useCmdK();

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-b px-8"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <h1 className="text-lg capitalize tracking-wide" style={{ color: "var(--text-primary)" }}>
        {selectedSymbol}
      </h1>

      <div className="flex items-center gap-4">
        <PnLTicker />

        <div
          className="h-7 px-3 flex items-center rounded text-xs tabular-nums"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          BTC $94,125
        </div>

        <div
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs"
          style={{
            color: isConnected ? "var(--profit)" : "var(--loss)",
            background: isConnected ? "rgba(110, 231, 160, 0.10)" : "rgba(248, 113, 113, 0.10)",
          }}
        >
          {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isConnected ? "Live" : "Offline"}
        </div>

        <button
          onClick={openPalette}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          aria-label="Open command palette (⌘K)"
        >
          <Search size={12} />
          <span>Search</span>
          <kbd
            className="rounded px-1 py-0.5 text-[10px] font-mono"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            ⌘K
          </kbd>
        </button>

        <button
          className="rounded-lg p-2 transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>

        <div className="w-8 h-8 rounded-full" style={{ background: "var(--bg-input)" }} />
      </div>
    </header>
  );
}
