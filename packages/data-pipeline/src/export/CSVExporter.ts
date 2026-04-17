import { createWriteStream } from "fs";
import type { WriteStream } from "fs";

import type { OHLCVRow } from "@tb/db";
import { stringify, type Stringifier } from "csv-stringify";

const CSV_COLUMNS = [
  "time",
  "exchange",
  "symbol",
  "timeframe",
  "open",
  "high",
  "low",
  "close",
  "volume",
  "trades_count",
] as const;

function rowToRecord(row: OHLCVRow): unknown[] {
  return [
    row.time instanceof Date ? row.time.toISOString() : row.time,
    row.exchange,
    row.symbol,
    row.timeframe,
    row.open,
    row.high,
    row.low,
    row.close,
    row.volume,
    row.tradesCount ?? "",
  ];
}

export class CSVExporter {
  private output: WriteStream | null = null;
  private stringifier: Stringifier | null = null;
  private rowCount = 0;

  open(outputPath: string): void {
    this.output = createWriteStream(outputPath);
    this.stringifier = stringify({ header: true, columns: [...CSV_COLUMNS] });
    this.stringifier.pipe(this.output);
    this.rowCount = 0;
  }

  appendBatch(rows: OHLCVRow[]): void {
    if (!this.stringifier) throw new Error("CSVExporter: call open() before appendBatch()");
    for (const row of rows) {
      this.stringifier.write(rowToRecord(row));
      this.rowCount++;
    }
  }

  close(): Promise<{ rowCount: number }> {
    return new Promise((resolve, reject) => {
      if (!this.stringifier || !this.output) {
        resolve({ rowCount: this.rowCount });
        return;
      }
      const output = this.output;
      const stringifier = this.stringifier;
      const count = this.rowCount;

      stringifier.end();
      output.on("finish", () => resolve({ rowCount: count }));
      output.on("error", reject);
      stringifier.on("error", reject);

      this.output = null;
      this.stringifier = null;
    });
  }

  async export(rows: OHLCVRow[], outputPath: string): Promise<{ rowCount: number }> {
    this.open(outputPath);
    this.appendBatch(rows);
    return this.close();
  }
}
