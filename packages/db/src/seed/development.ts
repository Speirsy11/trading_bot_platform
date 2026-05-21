import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { settings } from "../schema/settings";

// A conservative live-ingestion default for the Mac mini collector.
// Keep this exchange/pair set small and internally compatible: the current
// settings schema applies every pair to every exchange, so mixing USD/USDT
// pairs or many venues creates predictable BadSymbol/WebSocket failures.
export const DEFAULT_PAIRS = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "TRX/USDT",
  "DOGE/USDT",
  "ZEC/USDT",
  "ADA/USDT",
  "BCH/USDT",
];

export const DEFAULT_TIMEFRAMES = ["1m"];

export const DEFAULT_EXCHANGES = ["binance"];

export async function seedDevelopment(db: Database) {
  await db
    .insert(settings)
    .values([
      {
        key: "collection.pairs",
        value: JSON.stringify(DEFAULT_PAIRS),
        description: "List of trading pairs to collect data for",
      },
      {
        key: "collection.timeframes",
        value: JSON.stringify(DEFAULT_TIMEFRAMES),
        description: "List of timeframes to collect data for",
      },
      {
        key: "collection.exchanges",
        value: JSON.stringify(DEFAULT_EXCHANGES),
        description: "List of exchanges to collect data from",
      },
    ])
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: sql`excluded.value`, updatedAt: sql`NOW()` },
    });
}
