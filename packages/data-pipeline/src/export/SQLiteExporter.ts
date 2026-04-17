import type { OHLCVRow } from "@tb/db";
import Database from "better-sqlite3";
import type { Database as BetterSQLite3Database } from "better-sqlite3";

export class SQLiteExporter {
  private db: BetterSQLite3Database | null = null;
  private insertMany: ((data: OHLCVRow[]) => void) | null = null;
  private rowCount = 0;

  open(outputPath: string): void {
    const db = new Database(outputPath);

    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = OFF");

    db.exec(`
      CREATE TABLE IF NOT EXISTS ohlcv (
        time TEXT NOT NULL,
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        open TEXT NOT NULL,
        high TEXT NOT NULL,
        low TEXT NOT NULL,
        close TEXT NOT NULL,
        volume TEXT NOT NULL,
        trades_count INTEGER,
        UNIQUE (exchange, symbol, timeframe, time)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ohlcv_lookup
      ON ohlcv (exchange, symbol, timeframe, time)
    `);

    const insert = db.prepare(`
      INSERT OR REPLACE INTO ohlcv
      (time, exchange, symbol, timeframe, open, high, low, close, volume, trades_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertMany = db.transaction((data: OHLCVRow[]) => {
      for (const row of data) {
        insert.run(
          row.time instanceof Date ? row.time.toISOString() : row.time,
          row.exchange,
          row.symbol,
          row.timeframe,
          row.open,
          row.high,
          row.low,
          row.close,
          row.volume,
          row.tradesCount ?? null
        );
      }
    });

    this.db = db;
    this.rowCount = 0;
  }

  appendBatch(rows: OHLCVRow[]): void {
    if (!this.insertMany) throw new Error("SQLiteExporter: call open() before appendBatch()");
    this.insertMany(rows);
    this.rowCount += rows.length;
  }

  close(): { rowCount: number } {
    this.db?.close();
    const result = { rowCount: this.rowCount };
    this.db = null;
    this.insertMany = null;
    return result;
  }

  async export(rows: OHLCVRow[], outputPath: string): Promise<{ rowCount: number }> {
    this.open(outputPath);
    this.appendBatch(rows);
    return Promise.resolve(this.close());
  }
}
