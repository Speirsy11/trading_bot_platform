"use client";

import { Palette } from "lucide-react";
import { useState, useRef, useEffect, useId } from "react";

import { COLOUR_SCHEMES } from "@/providers/ColourSchemeProvider";
import { useUiStore } from "@/stores/ui";

export function ColourSchemeSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const colourScheme = useUiStore((s) => s.colourScheme);
  const setColourScheme = useUiStore((s) => s.setColourScheme);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
        style={{ color: "var(--text-secondary)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        aria-label="Change colour scheme"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <Palette size={14} />
        <span className="hidden sm:inline">Theme</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Colour scheme options"
          className="absolute right-0 top-full mt-2 w-52 rounded-xl border p-2 shadow-xl"
          style={{
            background: "var(--bg-card-solid)",
            borderColor: "var(--border)",
          }}
        >
          {COLOUR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => {
                setColourScheme(scheme.id);
                setOpen(false);
              }}
              role="menuitemradio"
              aria-checked={colourScheme === scheme.id}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors"
              style={{
                color: colourScheme === scheme.id ? "var(--text-primary)" : "var(--text-secondary)",
                background: colourScheme === scheme.id ? "var(--accent-dim)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (colourScheme !== scheme.id)
                  e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (colourScheme !== scheme.id) e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border"
                style={{
                  background: scheme.swatch,
                  borderColor: colourScheme === scheme.id ? scheme.swatch : "var(--border)",
                }}
              />
              <span>{scheme.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
