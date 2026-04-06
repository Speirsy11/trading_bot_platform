import { pgTable, text, uuid, timestamp, bigint, integer, unique } from "drizzle-orm/pg-core";

export const dataCollectionStatus = pgTable(
  "data_collection_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exchange: text("exchange").notNull(),
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    earliest: timestamp("earliest", { withTimezone: true, mode: "date" }),
    latest: timestamp("latest", { withTimezone: true, mode: "date" }),
    totalCandles: bigint("total_candles", { mode: "number" }).default(0),
    gapCount: integer("gap_count").default(0),
    status: text("status").default("idle"),
    lastCollectedAt: timestamp("last_collected_at", { withTimezone: true, mode: "date" }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
  },
  (table) => [
    unique("data_collection_status_unique").on(table.exchange, table.symbol, table.timeframe),
  ]
);

export type DataCollectionStatusRow = typeof dataCollectionStatus.$inferSelect;
export type DataCollectionStatusInsert = typeof dataCollectionStatus.$inferInsert;
