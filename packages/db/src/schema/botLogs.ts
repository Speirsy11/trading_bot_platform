import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

import { bots } from "./bots.js";

export const botLogs = pgTable("bot_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  level: text("level").notNull(), // info, warn, error, debug
  message: text("message").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type BotLogRow = typeof botLogs.$inferSelect;
export type BotLogInsert = typeof botLogs.$inferInsert;
