import { pgTable, text, uuid, timestamp, bigint, boolean, real } from "drizzle-orm/pg-core";

export const dataExports = pgTable("data_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  exchange: text("exchange").notNull(),
  symbols: text("symbols").array().notNull(),
  timeframe: text("timeframe").notNull(),
  startTime: timestamp("start_time", { withTimezone: true, mode: "date" }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true, mode: "date" }).notNull(),
  format: text("format").notNull(),
  compressed: boolean("compressed").default(true),
  filePath: text("file_path"),
  fileSize: bigint("file_size", { mode: "number" }),
  rowCount: bigint("row_count", { mode: "number" }),
  status: text("status").default("pending"),
  progress: real("progress").default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
});

export type DataExportRow = typeof dataExports.$inferSelect;
export type DataExportInsert = typeof dataExports.$inferInsert;
