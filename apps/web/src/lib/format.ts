import { formatDistanceToNow, parseISO } from "date-fns";

// Currency symbol map for non-Intl currencies (e.g. BTC)
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  BTC: "₿",
};

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

function resolveTimezone(tz?: string): string {
  if (tz !== undefined) return tz;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const store = require("@/stores/formatPreferences");
    return store.useFormatPreferences.getState().timezone as string;
  } catch {
    return "UTC";
  }
}

export function formatDate(date: Date | string | number, timezone?: string): string {
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  const tz = resolveTimezone(timezone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatDateShort(date: Date | string | number, timezone?: string): string {
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  const tz = resolveTimezone(timezone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatRelative(date: Date | string | number): string {
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Format a number using the user's stored display preferences.
 * Falls back to USD / 2 decimal places when called outside a React context
 * (e.g. in tests or SSR) because the zustand store is not importable there
 * without side effects — callers should pass explicit opts in those cases.
 */
export function formatWithPreferences(
  value: number,
  opts?: { currency?: string; decimals?: number }
): string {
  // Lazily read from the store if opts are not provided.
  // We use a dynamic require so this file stays importable in non-browser
  // environments without crashing.
  let currency = opts?.currency ?? "USD";
  let decimals = opts?.decimals ?? 2;

  if (!opts?.currency || !opts?.decimals) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const store = require("@/stores/formatPreferences");
      const state = store.useFormatPreferences.getState();
      if (!opts?.currency) currency = state.currency as string;
      if (!opts?.decimals) decimals = state.decimalPlaces as number;
    } catch {
      // Silently fall back to defaults in non-browser / test environments
    }
  }

  if (currency === "BTC") {
    const sym = CURRENCY_SYMBOLS["BTC"];
    return `${sym}${value.toFixed(decimals)}`;
  }

  // Use Intl for fiat currencies — handles locale separators properly
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Unknown currency code — fall back to plain number with symbol prefix
    const sym = CURRENCY_SYMBOLS[currency] ?? currency + " ";
    return `${sym}${value.toFixed(decimals)}`;
  }
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
