export function toNumber(value: number | string | null | undefined, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) {
    return fallback;
  }

  if (typeof value !== "string") {
    if (Array.isArray(fallback) && Array.isArray(value)) {
      return value as T;
    }

    if (
      !Array.isArray(fallback) &&
      typeof fallback === "object" &&
      fallback !== null &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      value !== null
    ) {
      return value as T;
    }

    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJsonValue(value: unknown): string {
  return JSON.stringify(value ?? {});
}
