import type { Database } from "@tb/db";
import { upsertOHLCV, type OHLCVInsert } from "@tb/db";

export class Deduplicator {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async upsert(rows: OHLCVInsert[]) {
    if (rows.length === 0) return [];
    return upsertOHLCV(this.db, rows);
  }
}
