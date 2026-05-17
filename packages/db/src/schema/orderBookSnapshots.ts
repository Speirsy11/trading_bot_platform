import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const orderBookSnapshots = pgTable(
  "orderbook_snapshots",
  {
    id: text("id").primaryKey(),
    exchange: text("exchange").notNull(),
    symbol: text("symbol").notNull(),
    bids: jsonb("bids").notNull(),
    asks: jsonb("asks").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true, mode: "date" }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).defaultNow(),
    source: text("source").notNull().default("websocket"),
    raw: text("raw"),
  },
  (table) => [
    index("idx_orderbook_snapshots_lookup").on(table.exchange, table.symbol, table.snapshotAt),
  ]
);

export type OrderBookSnapshotRow = typeof orderBookSnapshots.$inferSelect;
export type OrderBookSnapshotInsert = typeof orderBookSnapshots.$inferInsert;
