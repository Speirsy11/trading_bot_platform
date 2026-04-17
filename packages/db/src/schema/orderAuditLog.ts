import { pgTable, text, uuid, timestamp, numeric } from "drizzle-orm/pg-core";

import { bots } from "./bots";

export const orderAuditLog = pgTable("order_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  exchangeId: text("exchange_id").notNull(),
  symbol: text("symbol").notNull(),
  orderId: text("order_id"), // null until exchange confirms
  side: text("side"), // "buy" | "sell" — null when cancel originates without order context
  type: text("type"), // "market" | "limit" — null when cancel originates without order context
  amount: numeric("amount", { precision: 20, scale: 8 }), // null for cancel-only records
  price: numeric("price", { precision: 20, scale: 8 }), // null for market orders
  status: text("status").notNull(), // "placed" | "cancelled" | "failed"
  source: text("source").notNull(), // "manual" | "bot"
  botId: uuid("bot_id").references(() => bots.id, { onDelete: "set null" }), // null for manual orders
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull(),
  settledAt: timestamp("settled_at", { withTimezone: true, mode: "date" }),
  errorMessage: text("error_message"),
});

export type OrderAuditLogRow = typeof orderAuditLog.$inferSelect;
export type OrderAuditLogInsert = typeof orderAuditLog.$inferInsert;
