import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as backtestTradesSchema from "./schema/backtestTrades.js";
import * as backtestsSchema from "./schema/backtests.js";
import * as botLogsSchema from "./schema/botLogs.js";
import * as botTradesSchema from "./schema/botTrades.js";
import * as botsSchema from "./schema/bots.js";
import * as dataCollectionSchema from "./schema/dataCollection.js";
import * as dataExportsSchema from "./schema/dataExports.js";
import * as exchangeConfigsSchema from "./schema/exchangeConfigs.js";
import * as ohlcvSchema from "./schema/ohlcv.js";
import * as settingsSchema from "./schema/settings.js";

const schema = {
  ...ohlcvSchema,
  ...dataCollectionSchema,
  ...dataExportsSchema,
  ...exchangeConfigsSchema,
  ...botsSchema,
  ...botTradesSchema,
  ...botLogsSchema,
  ...backtestsSchema,
  ...backtestTradesSchema,
  ...settingsSchema,
};

export function createDb(connectionString?: string) {
  const url =
    connectionString ??
    process.env["DATABASE_URL"] ??
    "postgresql://trading_bot:changeme@localhost:5432/trading_bot_dev";

  const client = postgres(url);
  const db = drizzle(client, { schema });

  return { db, client };
}

export type Database = ReturnType<typeof createDb>["db"];
