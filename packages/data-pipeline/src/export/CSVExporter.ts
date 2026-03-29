import { createWriteStream } from "fs";

import type { OHLCVRow } from "@tb/db";
import { stringify } from "csv-stringify";

export class CSVExporter {
  async export(rows: OHLCVRow[], outputPath: string): Promise<{ rowCount: number }> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const stringifier = stringify({
        header: true,
        columns: [
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
        ],
      });

      stringifier.pipe(output);

      let rowCount = 0;
      for (const row of rows) {
        stringifier.write([
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
        ]);
        rowCount++;
      }

      stringifier.end();

      output.on("finish", () => resolve({ rowCount }));
      output.on("error", reject);
      stringifier.on("error", reject);
    });
  }
}
