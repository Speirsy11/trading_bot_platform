interface ChartThemeTokens {
  bgCard: string;
  border: string;
  grid: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  profit: string;
  loss: string;
  fontFamily: string;
}

export function getChartThemeTokens(_themeKey?: string): ChartThemeTokens {
  if (typeof document === "undefined") {
    return {
      bgCard: "#17171b",
      border: "rgba(200,165,90,0.10)",
      grid: "rgba(200,165,90,0.06)",
      textSecondary: "#9a9488",
      textMuted: "#5f5b52",
      accent: "#c8a55a",
      profit: "#6ee7a0",
      loss: "#f87171",
      fontFamily: "sans-serif",
    };
  }

  const style = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);

  return {
    bgCard: style.getPropertyValue("--bg-card-solid").trim() || "#131f38",
    border: style.getPropertyValue("--border").trim() || "rgba(255,255,255,0.08)",
    grid: style.getPropertyValue("--grid").trim() || "rgba(148,168,196,0.08)",
    textSecondary: style.getPropertyValue("--text-secondary").trim() || "#94a8c4",
    textMuted: style.getPropertyValue("--text-muted").trim() || "#546a8c",
    accent: style.getPropertyValue("--accent").trim() || "#5eaeff",
    profit: style.getPropertyValue("--profit").trim() || "#4ade80",
    loss: style.getPropertyValue("--loss").trim() || "#f87171",
    fontFamily: bodyStyle.fontFamily || "sans-serif",
  };
}

export function withAlpha(color: string, alpha: number): string {
  const normalized = color.trim();
  const clampedAlpha = Math.max(0, Math.min(1, alpha));

  if (/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(normalized)) {
    const hex = normalized.slice(1);
    const expanded =
      hex.length === 3 || hex.length === 4
        ? hex
            .split("")
            .map((char) => char + char)
            .join("")
        : hex;
    const [red, green, blue] = [0, 2, 4].map((offset) =>
      Number.parseInt(expanded.slice(offset, offset + 2), 16)
    );
    const sourceAlpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
    return `rgba(${red}, ${green}, ${blue}, ${Number((sourceAlpha * clampedAlpha).toFixed(3))})`;
  }

  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1] ?? "";
    const [red = "0", green = "0", blue = "0", sourceAlpha = "1"] = channels
      .split(",")
      .map((value) => value.trim());
    return `rgba(${red}, ${green}, ${blue}, ${Number(
      (Number.parseFloat(sourceAlpha) * clampedAlpha).toFixed(3)
    )})`;
  }

  return normalized;
}
