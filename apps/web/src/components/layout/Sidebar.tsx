"use client";

import {
  LayoutDashboard,
  Bot,
  FlaskConical,
  LineChart,
  Database,
  History,
  Settings,
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
];

export function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-full flex-col border-r transition-[width] duration-200"
      style={{
        width: sidebarOpen ? 220 : 64,
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex h-14 items-center justify-between px-3">
        {sidebarOpen && (
          <span className="text-sm font-semibold tracking-wide" style={{ color: "var(--accent)" }}>
            TradeBot
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 pt-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all"
              style={{
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: isActive ? "var(--accent-dim)" : "transparent",
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
    </aside>
  );
}
