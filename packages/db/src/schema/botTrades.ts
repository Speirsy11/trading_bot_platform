import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";

import { bots } from "./bots.js";

export const botTrades = pgTable("bot_trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  orderId: text("order_id"),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // buy, sell
  type: text("type").notNull(), // market, limit
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  cost: numeric("cost", { precision: 20, scale: 8 }).notNull(),
  fee: numeric("fee", { precision: 20, scale: 8 }),
  feeCurrency: text("fee_currency"),
  pnl: numeric("pnl", { precision: 20, scale: 8 }),
  pnlPercent: numeric("pnl_percent", { precision: 10, scale: 4 }),
  reason: text("reason"),
  executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type BotTradeRow = typeof botTrades.$inferSelect;
export type BotTradeInsert = typeof botTrades.$inferInsert;
