import { writeFile } from "fs/promises";

import type { OHLCVRow } from "@tb/db";

export class ParquetExporter {
  async export(rows: OHLCVRow[], outputPath: string): Promise<{ rowCount: number }> {
    // Parquet export using a simple JSON-based approach
    // For production, use parquetjs-lite or hyparquet once evaluated
    // For now, write as JSON-lines which can be converted to parquet externally
    const lines = rows.map((row) =>
      JSON.stringify({
        time: row.time instanceof Date ? row.time.toISOString() : row.time,
        exchange: row.exchange,
        symbol: row.symbol,
        timeframe: row.timeframe,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        trades_count: row.tradesCount,
      })
    );

    await writeFile(outputPath, lines.join("\n"), "utf-8");
    return { rowCount: rows.length };
  }
}
