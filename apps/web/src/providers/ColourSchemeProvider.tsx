"use client";

import { useEffect, type ReactNode } from "react";

import { useUiStore, type ColourScheme } from "@/stores/ui";

export function ColourSchemeProvider({ children }: { children: ReactNode }) {
  const colourScheme = useUiStore((s) => s.colourScheme);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.colorScheme = colourScheme;
    }
  }, [colourScheme]);

  return <>{children}</>;
}

export const COLOUR_SCHEMES: { id: ColourScheme; label: string; swatch: string }[] = [
  { id: "obsidian", label: "Obsidian Vault", swatch: "#c8a55a" },
  { id: "phosphor", label: "Phosphor Terminal", swatch: "#33ff33" },
  { id: "glacier", label: "Glacier", swatch: "#5eaeff" },
  { id: "forge", label: "Forge", swatch: "#e87a20" },
  { id: "ultraviolet", label: "Ultraviolet", swatch: "#a855f7" },
];
