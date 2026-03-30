"use client";

import { Bell, Wifi, WifiOff } from "lucide-react";

import { useSocket } from "@/providers/SocketProvider";
import { useUiStore } from "@/stores/ui";

export function Header() {
  const selectedSymbol = useUiStore((s) => s.selectedSymbol);
  const { isConnected } = useSocket();

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
