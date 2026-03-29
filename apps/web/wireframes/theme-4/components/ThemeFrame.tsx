import type { ReactNode } from "react";

import { PageCanvas } from "../../shared/components/PageCanvas";

interface ThemeFrameProps {
  page: "homepage" | "dashboard" | "trading" | "bots";
  children?: ReactNode;
}

const navItems = [
  { id: "dashboard", label: "DASH" },
  { id: "trading", label: "TRADE" },
  { id: "bots", label: "BOTS" },
] as const;

export function Theme4Frame({ page, children }: ThemeFrameProps) {
  if (page === "homepage") {
    return (
      <PageCanvas themeId="theme-4" pageId={page}>
        {children}
      </PageCanvas>
    );
  }

  return (
    <PageCanvas themeId="theme-4" pageId={page}>
      <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
        {/* Heavy sidebar */}
        <aside
          className="w-[56px] flex-shrink-0 flex flex-col items-center border-r-2"
          style={{ borderColor: "var(--border-hard)", background: "var(--bg-secondary)" }}
        >
          <a
            href="/theme-4/homepage"
            className="w-full py-4 flex items-center justify-center border-b-2"
            style={{ borderColor: "var(--border-hard)", textDecoration: "none" }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center text-xs font-black"
              style={{ background: "var(--accent)", color: "#111" }}
            >
              FG
            </div>
          </a>

          <nav className="flex-1 w-full py-3">
            {navItems.map((item) => {
              const active = page === item.id;
              return (
                <a
                  key={item.id}
                  href={`/theme-4/${item.id}`}
                  className="flex items-center justify-center py-3 text-[9px] font-bold transition-all"
                  style={{
                    color: active ? "#111" : "var(--text-muted)",
                    background: active ? "var(--accent)" : "transparent",
                    borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
                    textDecoration: "none",
                    fontFamily: "'Tektur', sans-serif",
                    letterSpacing: "0.08em",
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="h-11 flex items-center justify-between px-5 border-b-2"
            style={{ borderColor: "var(--border-hard)", background: "var(--bg-secondary)" }}
          >
            <h1
              className="text-sm tracking-widest"
              style={{ fontFamily: "'Tektur', sans-serif", color: "var(--accent)" }}
            >
              {page.toUpperCase()}
            </h1>
            <div className="flex items-center gap-4 text-xs">
              <span className="tabular-nums font-bold" style={{ color: "var(--accent)" }}>
                BTC $94,125
              </span>
              <div
                className="w-7 h-7"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-hard)" }}
              />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-5">{children}</main>
        </div>
      </div>
    </PageCanvas>
  );
}
