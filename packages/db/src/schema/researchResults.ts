import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { researchSweeps } from "./researchSweeps";

export const researchResults = pgTable(
  "research_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sweepId: uuid("sweep_id")
      .notNull()
      .references(() => researchSweeps.id, { onDelete: "cascade" }),
    strategy: text("strategy").notNull(),
    strategyName: text("strategy_name").notNull(),
    strategyParams: jsonb("strategy_params").notNull().default({}),
    paramHash: text("param_hash").notNull(),
    timeframe: text("timeframe").notNull(),
    marketMode: text("market_mode").notNull().default("spot"),
    symbols: jsonb("symbols").notNull().default([]),
    trainMetrics: jsonb("train_metrics").notNull().default({}),
    validationMetrics: jsonb("validation_metrics").notNull().default({}),
    testMetrics: jsonb("test_metrics").notNull().default({}),
    perSymbolResults: jsonb("per_symbol_results").notNull().default([]),
    portfolioEquityCurve: jsonb("portfolio_equity_curve").notNull().default([]),
    drawdownCurve: jsonb("drawdown_curve").notNull().default([]),
    dataCoverage: jsonb("data_coverage").notNull().default([]),
    qualified: boolean("qualified").notNull().default(false),
    qualificationReasons: jsonb("qualification_reasons").notNull().default([]),
    outOfSampleReturn: numeric("out_of_sample_return", { precision: 12, scale: 4 }),
    maxDrawdown: numeric("max_drawdown", { precision: 12, scale: 4 }),
    sharpeRatio: numeric("sharpe_ratio", { precision: 12, scale: 4 }),
    profitFactor: numeric("profit_factor", { precision: 12, scale: 4 }),
    winRate: numeric("win_rate", { precision: 12, scale: 4 }),
    totalTrades: numeric("total_trades", { precision: 20, scale: 8 }),
    positiveSymbols: numeric("positive_symbols", { precision: 20, scale: 8 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  },
  (table) => [
    index("idx_research_results_sweep").on(table.sweepId),
    index("idx_research_results_leaderboard").on(
      table.qualified,
      table.outOfSampleReturn,
      table.maxDrawdown
    ),
  ]
);

export type ResearchResultRow = typeof researchResults.$inferSelect;
export type ResearchResultInsert = typeof researchResults.$inferInsert;
