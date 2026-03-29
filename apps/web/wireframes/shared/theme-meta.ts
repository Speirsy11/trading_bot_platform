import type { ThemeMeta } from "./types";

export const themes: ThemeMeta[] = [
  {
    id: "theme-1",
    name: "Obsidian Vault",
    rationale:
      "Luxury dark editorial — deep charcoal with warm gold accents, serif headings, and a wide sidebar that evokes private-banking terminals.",
  },
  {
    id: "theme-2",
    name: "Phosphor Terminal",
    rationale:
      "CRT retro terminal — phosphor green on black with scanline overlays, monospace typography, and a command-line aesthetic throughout.",
  },
  {
    id: "theme-3",
    name: "Glacier",
    rationale:
      "Frosted glass Swiss banking — deep navy with translucent panels, backdrop blur, gradient accents, and a top-nav layout for a modern SaaS feel.",
  },
  {
    id: "theme-4",
    name: "Forge",
    rationale:
      "Industrial brutalist — warm steel with orange-amber accents, zero border-radius, heavy 2px borders, dense data presentation, and an icon-only sidebar.",
  },
  {
    id: "theme-5",
    name: "Ultraviolet",
    rationale:
      "Neon maximalist — deep purple-black with vivid purple/pink/teal gradient accents, glow effects, rounded cards, and a gradient-mesh background.",
  },
];

export const pages = ["homepage", "dashboard", "trading", "bots"] as const;

export type PageKey = (typeof pages)[number];

export function getThemeMeta(themeId: string) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0];
}
