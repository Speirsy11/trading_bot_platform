import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";

export const researchSweeps = pgTable("research_sweeps", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  config: jsonb("config").notNull().default({}),
  symbols: jsonb("symbols").notNull().default([]),
  timeframes: jsonb("timeframes").notNull().default([]),
  strategyKeys: jsonb("strategy_keys").notNull().default([]),
  bestResultId: uuid("best_result_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
});

export type ResearchSweepRow = typeof researchSweeps.$inferSelect;
export type ResearchSweepInsert = typeof researchSweeps.$inferInsert;
