import { format, formatDistanceToNow, parseISO } from "date-fns";

export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: Date | string | number): string {
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  return format(d, "MMM d, yyyy HH:mm");
}

export function formatDateShort(date: Date | string | number): string {
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  return format(d, "MMM d, HH:mm");
}

export function formatRelative(date: Date | string | number): string {
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  return formatDistanceToNow(d, { addSuffix: true });
}

export function pnlColor(value: number): string {
  if (value > 0) return "var(--profit)";
  if (value < 0) return "var(--loss)";
  return "var(--text-muted)";
}

export function pnlClass(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "";
}
