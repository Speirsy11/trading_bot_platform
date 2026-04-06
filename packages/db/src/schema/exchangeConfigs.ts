import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";

export const exchangeConfigs = pgTable("exchange_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  exchange: text("exchange").notNull().unique(),
  enabled: boolean("enabled").default(true),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  passphrase: text("passphrase"),
  sandbox: boolean("sandbox").default(false),
  metadata: text("metadata"), // JSON string for extra config
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type ExchangeConfigRow = typeof exchangeConfigs.$inferSelect;
export type ExchangeConfigInsert = typeof exchangeConfigs.$inferInsert;
