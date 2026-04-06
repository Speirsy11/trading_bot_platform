import { pgTable, text, uuid, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";

export const bots = pgTable("bots", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  strategy: text("strategy").notNull(),
  strategyParams: jsonb("strategy_params").default({}),
  exchange: text("exchange").notNull(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  mode: text("mode").notNull().default("backtest"), // backtest, paper, live
  status: text("status").notNull().default("idle"), // idle, running, stopped, error
  riskConfig: jsonb("risk_config").default({}),
  currentBalance: numeric("current_balance", { precision: 20, scale: 8 }),
  totalPnl: numeric("total_pnl", { precision: 20, scale: 8 }),
  totalTrades: numeric("total_trades", { precision: 20, scale: 8 }),
  winRate: numeric("win_rate", { precision: 5, scale: 2 }),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
  stoppedAt: timestamp("stopped_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type BotRow = typeof bots.$inferSelect;
export type BotInsert = typeof bots.$inferInsert;
