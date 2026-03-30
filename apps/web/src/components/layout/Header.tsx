"use client";

import { Bell, Wifi, WifiOff } from "lucide-react";

import { ColourSchemeSelector } from "@/components/layout/ColourSchemeSelector";
import { useSocket } from "@/providers/SocketProvider";
import { useUiStore } from "@/stores/ui";

export function Header() {
  const selectedSymbol = useUiStore((s) => s.selectedSymbol);
  const { isConnected } = useSocket();

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-b px-6"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {selectedSymbol}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs"
          style={{
            color: isConnected ? "var(--profit)" : "var(--loss)",
            background: isConnected ? "rgba(74, 222, 128, 0.1)" : "rgba(248, 113, 113, 0.1)",
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

        <ColourSchemeSelector />
      </div>
    </header>
  );
}
