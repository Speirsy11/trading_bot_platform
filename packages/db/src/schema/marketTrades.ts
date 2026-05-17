import { index, numeric, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const marketTrades = pgTable(
  "market_trades",
  {
    id: text("id").primaryKey(),
    exchange: text("exchange").notNull(),
    symbol: text("symbol").notNull(),
    tradeId: text("trade_id"),
    side: text("side"),
    price: numeric("price", { precision: 20, scale: 8 }).notNull(),
    amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
    cost: numeric("cost", { precision: 20, scale: 8 }),
    tradedAt: timestamp("traded_at", { withTimezone: true, mode: "date" }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).defaultNow(),
    source: text("source").notNull().default("websocket"),
    raw: text("raw"),
  },
  (table) => [
    unique("market_trades_exchange_trade_unique").on(table.exchange, table.symbol, table.tradeId),
    index("idx_market_trades_lookup").on(table.exchange, table.symbol, table.tradedAt),
  ]
);

export type MarketTradeRow = typeof marketTrades.$inferSelect;
export type MarketTradeInsert = typeof marketTrades.$inferInsert;
