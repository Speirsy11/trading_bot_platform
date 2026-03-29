import {
  pgTable,
  text,
  numeric,
  timestamp,
  bigint,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const ohlcv = pgTable(
  "ohlcv",
  {
    time: timestamp("time", { withTimezone: true, mode: "date" }).notNull(),
    exchange: text("exchange").notNull(),
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    open: numeric("open", { precision: 20, scale: 8 }).notNull(),
    high: numeric("high", { precision: 20, scale: 8 }).notNull(),
    low: numeric("low", { precision: 20, scale: 8 }).notNull(),
    close: numeric("close", { precision: 20, scale: 8 }).notNull(),
    volume: numeric("volume", { precision: 20, scale: 8 }).notNull(),
    tradesCount: bigint("trades_count", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  },
  (table) => [
    unique("ohlcv_unique").on(table.exchange, table.symbol, table.timeframe, table.time),
    index("idx_ohlcv_lookup").on(table.exchange, table.symbol, table.timeframe, table.time),
  ],
);

export type OHLCVRow = typeof ohlcv.$inferSelect;
export type OHLCVInsert = typeof ohlcv.$inferInsert;
