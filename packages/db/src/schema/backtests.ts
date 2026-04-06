import { pgTable, text, uuid, timestamp, numeric, integer, jsonb } from "drizzle-orm/pg-core";

export const backtests = pgTable("backtests", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  strategy: text("strategy").notNull(),
  strategyParams: jsonb("strategy_params").default({}),
  exchange: text("exchange").notNull(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  startTime: timestamp("start_time", { withTimezone: true, mode: "date" }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true, mode: "date" }).notNull(),
  initialBalance: numeric("initial_balance", { precision: 20, scale: 8 }).notNull(),
  finalBalance: numeric("final_balance", { precision: 20, scale: 8 }),
  totalPnl: numeric("total_pnl", { precision: 20, scale: 8 }),
  totalPnlPercent: numeric("total_pnl_percent", { precision: 10, scale: 4 }),
  totalTrades: integer("total_trades"),
  winningTrades: integer("winning_trades"),
  losingTrades: integer("losing_trades"),
  winRate: numeric("win_rate", { precision: 5, scale: 2 }),
  maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 4 }),
  sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale: 4 }),
  profitFactor: numeric("profit_factor", { precision: 10, scale: 4 }),
  metrics: jsonb("metrics"), // additional computed metrics
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  error: text("error"),
  riskConfig: jsonb("risk_config").default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
});

export type BacktestRow = typeof backtests.$inferSelect;
export type BacktestInsert = typeof backtests.$inferInsert;
