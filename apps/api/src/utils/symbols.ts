export function normalizeMarketSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function uniqueStrings<T extends string>(values: readonly T[]) {
  return Array.from(new Set(values));
}

export function uniqueNormalizedSymbols(symbols: readonly string[]) {
  return uniqueStrings(symbols.map(normalizeMarketSymbol).filter(Boolean));
}
