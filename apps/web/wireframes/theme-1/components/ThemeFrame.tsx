import type { ReactNode } from "react";

import { PageCanvas } from "../../shared/components/PageCanvas";

interface ThemeFrameProps {
  page: "homepage" | "dashboard" | "trading" | "bots";
  children?: ReactNode;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "◆" },
  { id: "trading", label: "Trading", icon: "◇" },
  { id: "bots", label: "Bots", icon: "⬡" },
] as const;

export function Theme1Frame({ page, children }: ThemeFrameProps) {
  if (page === "homepage") {
    return (
      <PageCanvas themeId="theme-1" pageId={page}>
        {children}
      </PageCanvas>
    );
  }

  return (
    <PageCanvas themeId="theme-1" pageId={page}>
      <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
        {/* Sidebar */}
        <aside
          className="w-[240px] flex-shrink-0 flex flex-col border-r"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
        >
          <a
            href="/theme-1/homepage"
            className="flex items-center gap-3 px-6 py-5 border-b"
            style={{ borderColor: "var(--border)", textDecoration: "none" }}
          >
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--accent)", color: "#08080a" }}
            >
              OV
            </div>
            <span
              className="text-lg tracking-wide"
              style={{ fontFamily: "'Playfair Display', serif", color: "var(--accent)" }}
            >
              Obsidian
            </span>
          </a>

          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {navItems.map((item) => {
              const active = page === item.id;
              return (
                <a
                  key={item.id}
                  href={`/theme-1/${item.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all duration-200"
                  style={{
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    background: active ? "var(--accent-dim)" : "transparent",
                    borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                    textDecoration: "none",
                  }}
                >
                  <span className="text-xs opacity-60">{item.icon}</span>
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              ◈ Obsidian Vault v1.0
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="h-14 flex items-center justify-between px-8 border-b"
            style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
          >
            <h1 className="text-lg capitalize tracking-wide">{page}</h1>
            <div className="flex items-center gap-4">
              <div
                className="h-7 px-3 flex items-center rounded text-xs"
                style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
              >
                BTC $94,125
              </div>
              <div className="w-8 h-8 rounded-full" style={{ background: "var(--bg-input)" }} />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-8">{children}</main>
        </div>
      </div>
    </PageCanvas>
  );
}
