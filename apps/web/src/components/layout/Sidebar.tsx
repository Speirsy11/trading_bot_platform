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
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Mobile backdrop — closes sidebar on tap outside */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed left-0 top-0 z-40 flex h-full flex-col border-r",
          // Mobile: translate off-screen when closed; desktop: width-based collapse
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "transition-transform duration-200 md:transition-[width,transform]",
        ].join(" ")}
        style={{
          // On mobile always 240px wide (overlay drawer); desktop uses sidebarOpen width
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
          {/* Collapse button — hidden on mobile (hamburger in header handles it) */}
          <button
            onClick={toggleSidebar}
            className="ml-auto hidden rounded-lg p-1.5 transition-colors md:flex"
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
                onClick={() => {
                  // Close drawer on mobile after navigation
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
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
                {/* Always shown on mobile; on desktop only when expanded */}
                <span className={sidebarOpen ? "inline" : "md:hidden"}>{item.label}</span>
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
    </>
  );
}
