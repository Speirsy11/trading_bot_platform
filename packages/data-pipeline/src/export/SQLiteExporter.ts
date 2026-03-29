import type { OHLCVRow } from "@tb/db";
import Database from "better-sqlite3";

export class SQLiteExporter {
  async export(rows: OHLCVRow[], outputPath: string): Promise<{ rowCount: number }> {
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

    const insertMany = db.transaction((data: OHLCVRow[]) => {
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
          row.tradesCount ?? null,
        );
      }
    });

    insertMany(rows);
    const count = rows.length;
    db.close();

    return { rowCount: count };
  }
}
