import { bigint, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const ingestionHealth = pgTable(
  "ingestion_health",
  {
    id: text("id").primaryKey(),
    exchange: text("exchange").notNull(),
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    latestCandleAt: timestamp("latest_candle_at", { withTimezone: true, mode: "date" }),
    latestEventAt: timestamp("latest_event_at", { withTimezone: true, mode: "date" }),
    websocketStatus: text("websocket_status").notNull().default("unknown"),
    disconnectedSince: timestamp("disconnected_since", { withTimezone: true, mode: "date" }),
    restFallbackCount: integer("rest_fallback_count").notNull().default(0),
    validationFailures: integer("validation_failures").notNull().default(0),
    apiErrors: integer("api_errors").notNull().default(0),
    repairFailures: integer("repair_failures").notNull().default(0),
    backfillBacklog: integer("backfill_backlog").notNull().default(0),
    candlesInserted: bigint("candles_inserted", { mode: "number" }).notNull().default(0),
    missingCandles: integer("missing_candles").notNull().default(0),
    completenessBps: integer("completeness_bps").notNull().default(10000),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
  },
  (table) => [
    unique("ingestion_health_unique").on(table.exchange, table.symbol, table.timeframe),
    index("idx_ingestion_health_lookup").on(table.exchange, table.symbol, table.timeframe),
  ]
);

export type IngestionHealthRow = typeof ingestionHealth.$inferSelect;
export type IngestionHealthInsert = typeof ingestionHealth.$inferInsert;
