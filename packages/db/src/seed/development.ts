import { sql } from "drizzle-orm";

import type { Database } from "../client.js";
import { settings } from "../schema/settings.js";

const DEFAULT_PAIRS = [
  "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT",
  "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "DOT/USDT", "MATIC/USDT",
  "LINK/USDT", "UNI/USDT", "ATOM/USDT", "LTC/USDT", "FIL/USDT",
  "NEAR/USDT", "APT/USDT", "ARB/USDT", "OP/USDT", "SUI/USDT",
];

const DEFAULT_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

const DEFAULT_EXCHANGES = ["binance"];

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
