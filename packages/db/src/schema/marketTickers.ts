import { index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const marketTickers = pgTable(
  "market_tickers",
  {
    id: text("id").primaryKey(),
    exchange: text("exchange").notNull(),
    symbol: text("symbol").notNull(),
    bid: numeric("bid", { precision: 20, scale: 8 }),
    ask: numeric("ask", { precision: 20, scale: 8 }),
    last: numeric("last", { precision: 20, scale: 8 }).notNull(),
    volume: numeric("volume", { precision: 20, scale: 8 }),
    change24h: numeric("change_24h", { precision: 10, scale: 4 }),
    tickerAt: timestamp("ticker_at", { withTimezone: true, mode: "date" }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).defaultNow(),
    source: text("source").notNull().default("websocket"),
    raw: text("raw"),
  },
  (table) => [index("idx_market_tickers_lookup").on(table.exchange, table.symbol, table.tickerAt)]
);

export type MarketTickerRow = typeof marketTickers.$inferSelect;
export type MarketTickerInsert = typeof marketTickers.$inferInsert;
