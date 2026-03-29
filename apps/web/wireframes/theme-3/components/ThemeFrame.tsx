import type { ReactNode } from "react";

import { PageCanvas } from "../../shared/components/PageCanvas";

interface ThemeFrameProps {
  page: "homepage" | "dashboard" | "trading" | "bots";
  children?: ReactNode;
}

const navLinks = [
  { id: "dashboard", label: "Dashboard" },
  { id: "trading", label: "Trading" },
  { id: "bots", label: "Bots" },
] as const;

export function Theme3Frame({ page, children }: ThemeFrameProps) {
  if (page === "homepage") {
    return (
      <PageCanvas themeId="theme-3" pageId={page}>
        {children}
      </PageCanvas>
    );
  }

  return (
    <PageCanvas themeId="theme-3" pageId={page}>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        {/* Atmospheric gradient */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, rgba(94,174,255,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(74,222,128,0.04) 0%, transparent 40%)",
          }}
        />

        {/* Top Nav */}
        <nav
          className="relative z-10 flex items-center justify-between px-8 py-4"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "rgba(10, 22, 40, 0.8)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex items-center gap-8">
            <a
              href="/theme-3/homepage"
              className="flex items-center gap-2.5"
              style={{ textDecoration: "none" }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-semibold"
                style={{
                  background: "linear-gradient(135deg, #5eaeff, #4ade80)",
                  color: "#0a1628",
                }}
              >
                G
              </div>
              <span
                className="text-lg font-light tracking-wide"
                style={{ color: "var(--text-primary)" }}
              >
                Glacier
              </span>
            </a>
            <div className="flex items-center gap-1">
              {navLinks.map((link) => {
                const active = page === link.id;
                return (
                  <a
                    key={link.id}
                    href={`/theme-3/${link.id}`}
                    className="px-4 py-2 text-sm rounded-lg transition-all"
                    style={{
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                      background: active ? "var(--accent-dim)" : "transparent",
                      textDecoration: "none",
                    }}
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="px-3 py-1.5 rounded-lg text-xs tabular-nums"
              style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
            >
              BTC $94,125
            </div>
            <div
              className="w-9 h-9 rounded-full"
              style={{
                background: "linear-gradient(135deg, rgba(94,174,255,0.2), rgba(74,222,128,0.2))",
                border: "1px solid var(--border)",
              }}
            />
          </div>
        </nav>

        {/* Content */}
        <main className="relative z-10 px-8 py-8">{children}</main>
      </div>
    </PageCanvas>
  );
}
