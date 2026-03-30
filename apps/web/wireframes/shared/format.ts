const numberFormatterCache = new Map<string, Intl.NumberFormat>();
const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getNumberFormatter(options: Intl.NumberFormatOptions = {}) {
  const key = JSON.stringify(options);
  const cached = numberFormatterCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat("en-US", options);
  numberFormatterCache.set(key, formatter);
  return formatter;
}

function getTimeFormatter(options: Intl.DateTimeFormatOptions = {}) {
  const mergedOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
    ...options,
  };
  const key = JSON.stringify(mergedOptions);
  const cached = timeFormatterCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", mergedOptions);
  timeFormatterCache.set(key, formatter);
  return formatter;
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return getNumberFormatter(options).format(value);
}

export function formatTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions) {
  return getTimeFormatter(options).format(new Date(value));
}

export function installDeterministicLocaleFormatters() {
  const globalState = globalThis as typeof globalThis & {
    __wireframesLocalePatched?: boolean;
  };

  if (globalState.__wireframesLocalePatched) {
    return;
  }

  globalState.__wireframesLocalePatched = true;

  Number.prototype.toLocaleString = function toLocaleStringPatched(
    _locales?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions
  ) {
    return formatNumber(Number(this), options);
  };

  Date.prototype.toLocaleTimeString = function toLocaleTimeStringPatched(
    _locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions
  ) {
    return formatTime(this, options);
  };
}
