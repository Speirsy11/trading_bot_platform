import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as backtestTradesSchema from "./schema/backtestTrades";
import * as backtestsSchema from "./schema/backtests";
import * as botLogsSchema from "./schema/botLogs";
import * as botTradesSchema from "./schema/botTrades";
import * as botsSchema from "./schema/bots";
import * as dataCollectionSchema from "./schema/dataCollection";
import * as dataExportsSchema from "./schema/dataExports";
import * as exchangeConfigsSchema from "./schema/exchangeConfigs";
import * as ohlcvSchema from "./schema/ohlcv";
import * as settingsSchema from "./schema/settings";

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
