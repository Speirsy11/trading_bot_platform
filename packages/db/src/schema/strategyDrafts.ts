import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";

export const strategyDrafts = pgTable("strategy_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  strategy: text("strategy").notNull(),
  strategyParams: jsonb("strategy_params").default({}),
  riskConfig: jsonb("risk_config").default({}),
  exchange: text("exchange").notNull().default("binance"),
  symbol: text("symbol").notNull().default("BTC/USDT"),
  timeframe: text("timeframe").notNull().default("1h"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type StrategyDraftRow = typeof strategyDrafts.$inferSelect;
export type StrategyDraftInsert = typeof strategyDrafts.$inferInsert;
