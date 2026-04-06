import { pgTable, text, uuid, timestamp, numeric } from "drizzle-orm/pg-core";

import { backtests } from "./backtests";

export const backtestTrades = pgTable("backtest_trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  backtestId: uuid("backtest_id")
    .notNull()
    .references(() => backtests.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  cost: numeric("cost", { precision: 20, scale: 8 }).notNull(),
  fee: numeric("fee", { precision: 20, scale: 8 }),
  pnl: numeric("pnl", { precision: 20, scale: 8 }),
  pnlPercent: numeric("pnl_percent", { precision: 10, scale: 4 }),
  balance: numeric("balance", { precision: 20, scale: 8 }),
  reason: text("reason"),
  executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type BacktestTradeRow = typeof backtestTrades.$inferSelect;
export type BacktestTradeInsert = typeof backtestTrades.$inferInsert;
