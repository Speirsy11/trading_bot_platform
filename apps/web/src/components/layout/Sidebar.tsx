"use client";

import {
  LayoutDashboard,
  Bot,
  FlaskConical,
  LineChart,
  Database,
  History,
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUiStore } from "@/stores/ui";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bots", label: "Bots", icon: Bot },
  { href: "/backtest", label: "Backtest", icon: FlaskConical },
  { href: "/trading", label: "Trading", icon: LineChart },
  { href: "/market-data", label: "Market Data", icon: Database },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/status", label: "Status", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-full flex-col border-r transition-[width] duration-200"
      style={{
        width: sidebarOpen ? 240 : 64,
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Brand */}
      <div
        className="flex h-14 items-center gap-3 border-b px-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-xs font-bold"
          style={{ background: "var(--accent)", color: "#08080a" }}
        >
          OV
        </div>
        {sidebarOpen && (
          <span
            className="text-lg tracking-wide"
            style={{ fontFamily: "var(--font-display), serif", color: "var(--accent)" }}
          >
            Obsidian
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto rounded-lg p-1.5 transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200"
              style={{
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: isActive ? "var(--accent-dim)" : "transparent",
                borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <item.icon size={18} />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "var(--border)" }}>
        {sidebarOpen ? (
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            ◈ Obsidian Vault v1.0
          </div>
        ) : (
          <div className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
            ◈
          </div>
        )}
      </div>
    </aside>
  );
}
