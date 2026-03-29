import type { ReactNode } from "react";

import { PageCanvas } from "../../shared/components/PageCanvas";

interface ThemeFrameProps {
  page: "homepage" | "dashboard" | "trading" | "bots";
  children?: ReactNode;
}

const navLinks = [
  { id: "dashboard", label: "Dashboard", emoji: "⚡" },
  { id: "trading", label: "Trading", emoji: "📊" },
  { id: "bots", label: "Bots", emoji: "🤖" },
] as const;

export function Theme5Frame({ page, children }: ThemeFrameProps) {
  if (page === "homepage") {
    return (
      <PageCanvas themeId="theme-5" pageId={page}>
        {children}
      </PageCanvas>
    );
  }

  return (
    <PageCanvas themeId="theme-5" pageId={page}>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        {/* Background gradient mesh */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 10% 20%, rgba(168,85,247,0.1) 0%, transparent 40%),
              radial-gradient(ellipse at 90% 80%, rgba(236,72,153,0.08) 0%, transparent 35%),
              radial-gradient(ellipse at 50% 50%, rgba(6,214,160,0.04) 0%, transparent 50%)
            `,
          }}
        />

        {/* Sidebar */}
        <aside
          className="fixed left-0 top-0 bottom-0 w-[220px] z-20 flex flex-col border-r"
          style={{
            borderColor: "var(--border)",
            background: "rgba(12, 6, 20, 0.95)",
            backdropFilter: "blur(20px)",
          }}
        >
          <a
            href="/theme-5/homepage"
            className="flex items-center gap-3 px-5 py-5 border-b"
            style={{ borderColor: "var(--border)", textDecoration: "none" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)", color: "white" }}
            >
              UV
            </div>
            <div>
              <div className="text-sm font-semibold uv-gradient-text">Ultraviolet</div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Trading v5
              </div>
            </div>
          </a>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {navLinks.map((link) => {
              const active = page === link.id;
              return (
                <a
                  key={link.id}
                  href={`/theme-5/${link.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all"
                  style={{
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    background: active
                      ? "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.1))"
                      : "transparent",
                    border: active ? "1px solid var(--border)" : "1px solid transparent",
                    textDecoration: "none",
                  }}
                >
                  <span>{link.emoji}</span>
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{
                background: "linear-gradient(135deg, rgba(6,214,160,0.1), rgba(168,85,247,0.1))",
                border: "1px solid rgba(6,214,160,0.15)",
              }}
            >
              <div className="font-medium" style={{ color: "var(--accent-alt)" }}>
                Paper Mode
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Risk-free trading
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="ml-[220px] relative z-10">
          <header
            className="flex items-center justify-between px-8 py-4 border-b"
            style={{
              borderColor: "var(--border)",
              background: "rgba(12, 6, 20, 0.6)",
              backdropFilter: "blur(12px)",
            }}
          >
            <h1 className="text-xl capitalize">{page}</h1>
            <div className="flex items-center gap-4">
              <div
                className="px-3 py-1.5 rounded-xl text-xs tabular-nums"
                style={{
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  border: "1px solid var(--border)",
                }}
              >
                BTC $94,125
              </div>
              <div
                className="w-9 h-9 rounded-full"
                style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)", opacity: 0.7 }}
              />
            </div>
          </header>
          <main className="p-8">{children}</main>
        </div>
      </div>
    </PageCanvas>
  );
}
