import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ingestionEvents = pgTable(
  "ingestion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exchange: text("exchange"),
    symbol: text("symbol"),
    timeframe: text("timeframe"),
    eventType: text("event_type").notNull(),
    severity: text("severity").notNull().default("info"),
    message: text("message").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  },
  (table) => [index("idx_ingestion_events_lookup").on(table.eventType, table.createdAt)]
);

export type IngestionEventRow = typeof ingestionEvents.$inferSelect;
export type IngestionEventInsert = typeof ingestionEvents.$inferInsert;
