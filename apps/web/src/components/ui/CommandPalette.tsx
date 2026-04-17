"use client";

import {
  BarChart2,
  Bot,
  History,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ShortcutHelp } from "@/components/ui/ShortcutHelp";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Bots", href: "/bots", Icon: Bot },
  { label: "New Bot", href: "/bots/new", Icon: Plus },
  { label: "Backtest", href: "/backtest", Icon: BarChart2 },
  { label: "Trade History", href: "/history", Icon: History },
  { label: "Market Data", href: "/market-data", Icon: TrendingUp },
  { label: "Trading", href: "/trading", Icon: Zap },
  { label: "Settings", href: "/settings", Icon: Settings },
];

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Filter nav items by query
  const filtered = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  // Reset state each time palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      // Focus input on next tick so the DOM is painted
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Clamp activeIndex when filtered list shrinks
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  // Keyboard handler for the palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev === 0 ? Math.max(filtered.length - 1, 0) : prev - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[activeIndex]) {
            navigate(filtered[activeIndex].href);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    },
    [activeIndex, filtered, navigate, onClose]
  );

  if (!isOpen && !showHelp) return null;

  return (
    <>
      {/* Shortcut help overlay — rendered above everything */}
      <ShortcutHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="glass-panel w-full" style={{ maxWidth: 600 }} onKeyDown={handleKeyDown}>
            {/* Search input row */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <Search size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Go to page…"
                className="flex-1 bg-transparent border-none outline-none text-sm"
                style={{ color: "var(--text-primary)" }}
                autoComplete="off"
                spellCheck={false}
              />
              {/* Shortcut hint */}
              <button
                onClick={() => setShowHelp(true)}
                className="rounded px-1.5 py-0.5 text-[11px] transition-colors"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                aria-label="Keyboard shortcuts help"
                tabIndex={-1}
              >
                ?
              </button>
            </div>

            {/* Results list */}
            <ul
              ref={listRef}
              className="overflow-y-auto py-1.5"
              style={{ maxHeight: "calc(60vh - 56px)" }}
              role="listbox"
              aria-label="Navigation items"
            >
              {filtered.length === 0 ? (
                <li
                  className="px-4 py-6 text-center text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  No results for &ldquo;{query}&rdquo;
                </li>
              ) : (
                filtered.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <li
                      key={item.href}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                      style={{
                        background: isActive ? "var(--accent-dim)" : "transparent",
                        color: isActive ? "var(--accent)" : "var(--text-primary)",
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <item.Icon
                          size={15}
                          style={{
                            color: isActive ? "var(--accent)" : "var(--text-muted)",
                            flexShrink: 0,
                          }}
                        />
                        <span className="text-sm truncate">{item.label}</span>
                      </div>

                      {isActive && (
                        <kbd
                          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-mono"
                          style={{
                            background: "var(--bg-input)",
                            color: "var(--accent)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          ↵
                        </kbd>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
