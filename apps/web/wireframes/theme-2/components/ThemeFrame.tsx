import type { ReactNode } from "react";

import { PageCanvas } from "../../shared/components/PageCanvas";

interface ThemeFrameProps {
  page: "homepage" | "dashboard" | "trading" | "bots";
  children?: ReactNode;
}

const navItems = [
  { id: "dashboard", label: "[1] DASH", cmd: "dashboard" },
  { id: "trading", label: "[2] TRADE", cmd: "trading" },
  { id: "bots", label: "[3] BOTS", cmd: "bots" },
] as const;

export function Theme2Frame({ page, children }: ThemeFrameProps) {
  if (page === "homepage") {
    return (
      <PageCanvas themeId="theme-2" pageId={page}>
        <div className="scanlines" />
        {children}
      </PageCanvas>
    );
  }

  return (
    <PageCanvas themeId="theme-2" pageId={page}>
      <div className="scanlines" />
      <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
        {/* Terminal Sidebar */}
        <aside
          className="w-[200px] flex-shrink-0 flex flex-col"
          style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}
        >
          <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <a
              href="/theme-2/homepage"
              className="crt-glow text-sm font-bold block"
              style={{
                color: "var(--accent)",
                textDecoration: "none",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              ▌PHOSPHOR v2.0
            </a>
            <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              SESSION ACTIVE
            </div>
          </div>

          <nav className="flex-1 px-2 py-3 space-y-0.5">
            {navItems.map((item) => {
              const active = page === item.id;
              return (
                <a
                  key={item.id}
                  href={`/theme-2/${item.id}`}
                  className="block px-3 py-1.5 text-xs transition-all"
                  style={{
                    color: active ? "#010a01" : "var(--text-secondary)",
                    background: active ? "var(--accent)" : "transparent",
                    textDecoration: "none",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {active ? "▸ " : "  "}
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div
            className="px-4 py-3 border-t text-[9px]"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <div>MEM: 842MB</div>
            <div>CPU: 12.4%</div>
            <div>LAT: 3ms</div>
          </div>
        </aside>

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="h-10 flex items-center justify-between px-4 border-b"
            style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
          >
            <div className="flex items-center gap-3 text-xs">
              <span style={{ color: "var(--text-muted)" }}>$</span>
              <span className="crt-glow uppercase">{page}</span>
              <span style={{ color: "var(--text-muted)" }}>--mode=live</span>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <span style={{ color: "var(--text-muted)" }}>BTC</span>
              <span className="crt-glow tabular-nums">$94,125</span>
              <span className="animate-pulse" style={{ color: "var(--accent)" }}>
                ●
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4">{children}</main>
        </div>
      </div>
    </PageCanvas>
  );
}
