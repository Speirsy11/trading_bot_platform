import type { ThemeMeta } from "./types";

export const themes: ThemeMeta[] = [
  {
    id: "theme-1",
    name: "Theme 1",
    rationale: "",
  },
  {
    id: "theme-2",
    name: "Theme 2",
    rationale: "",
  },
  {
    id: "theme-3",
    name: "Theme 3",
    rationale: "",
  },
  {
    id: "theme-4",
    name: "Theme 4",
    rationale: "",
  },
  {
    id: "theme-5",
    name: "Theme 5",
    rationale: "",
  },
];

export const pages = ["homepage", "dashboard", "trading", "bots"] as const;

export type PageKey = (typeof pages)[number];

export function getThemeMeta(themeId: string) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0];
}
