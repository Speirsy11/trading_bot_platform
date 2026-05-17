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
import * as ingestionEventsSchema from "./schema/ingestionEvents";
import * as ingestionHealthSchema from "./schema/ingestionHealth";
import * as marketTickersSchema from "./schema/marketTickers";
import * as marketTradesSchema from "./schema/marketTrades";
import * as ohlcvSchema from "./schema/ohlcv";
import * as orderAuditLogSchema from "./schema/orderAuditLog";
import * as orderBookSnapshotsSchema from "./schema/orderBookSnapshots";
import * as settingsSchema from "./schema/settings";
import * as webhooksSchema from "./schema/webhooks";

const schema = {
  ...ohlcvSchema,
  ...marketTradesSchema,
  ...marketTickersSchema,
  ...orderBookSnapshotsSchema,
  ...ingestionEventsSchema,
  ...ingestionHealthSchema,
  ...dataCollectionSchema,
  ...dataExportsSchema,
  ...exchangeConfigsSchema,
  ...botsSchema,
  ...botTradesSchema,
  ...botLogsSchema,
  ...orderAuditLogSchema,
  ...backtestsSchema,
  ...backtestTradesSchema,
  ...settingsSchema,
  ...webhooksSchema,
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
