// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../parquetjs-lite.d.ts" />
import type { OHLCVRow } from "@tb/db";
// parquetjs-lite is CommonJS; types declared in parquetjs-lite.d.ts
import parquet from "parquetjs-lite";

/**
 * Parquet schema mirroring the CSV export columns.
 *
 * OHLCV price/volume fields are stored as DOUBLE. The source values in
 * Postgres are numeric(20,8); we parse them to JS numbers on write. This
 * preserves precision well within the range of typical crypto OHLCV data
 * (below ~2^53 at 8 decimal places) and keeps the Parquet file cheap to
 * read back in Python/DuckDB without any custom decimal handling.
 */
const OHLCV_PARQUET_SCHEMA = new parquet.ParquetSchema({
  // INT64 (Unix ms) instead of TIMESTAMP_MILLIS avoids a parquetjs-lite reader
  // bug where BigInt statistics cause "Cannot convert BigInt to number" errors.
  time: { type: "INT64" },
  exchange: { type: "UTF8" },
  symbol: { type: "UTF8" },
  timeframe: { type: "UTF8" },
  open: { type: "DOUBLE" },
  high: { type: "DOUBLE" },
  low: { type: "DOUBLE" },
  close: { type: "DOUBLE" },
  volume: { type: "DOUBLE" },
  trades_count: { type: "INT64", optional: true },
});

type RowSource = Iterable<OHLCVRow> | AsyncIterable<OHLCVRow>;

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return typeof value === "number" ? value : Number(value);
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

async function* asAsyncIterable<T>(source: Iterable<T> | AsyncIterable<T>): AsyncIterable<T> {
  if (Symbol.asyncIterator in Object(source)) {
    yield* source as AsyncIterable<T>;
    return;
  }
  for (const item of source as Iterable<T>) {
    yield item;
  }
}

/**
 * Stream rows from `source` into a Parquet file at `outputPath`.
 *
 * Uses `ParquetWriter.openFile` which buffers rows per row-group (default
 * 4096) and flushes to disk as it goes — we never hold the full dataset in
 * memory. Callers can pass either a synchronous `OHLCVRow[]` or an
 * `AsyncIterable` (e.g. a pg cursor wrapped as an async generator).
 */
export async function exportParquet(
  source: RowSource,
  outputPath: string
): Promise<{ rowCount: number }> {
  const writer = await parquet.ParquetWriter.openFile(OHLCV_PARQUET_SCHEMA, outputPath);

  let rowCount = 0;
  try {
    for await (const row of asAsyncIterable(source)) {
      const record: Record<string, unknown> = {
        time: BigInt(toDate(row.time).getTime()),
        exchange: row.exchange,
        symbol: row.symbol,
        timeframe: row.timeframe,
        open: toNumber(row.open),
        high: toNumber(row.high),
        low: toNumber(row.low),
        close: toNumber(row.close),
        volume: toNumber(row.volume),
      };
      if (row.tradesCount !== null && row.tradesCount !== undefined) {
        record.trades_count = row.tradesCount;
      }
      await writer.appendRow(record);
      rowCount++;
    }
  } finally {
    await writer.close();
  }

  return { rowCount };
}

/**
 * Class wrapper kept for parity with the other exporters and
 * backwards compatibility with `ExportManager`.
 */
export class ParquetExporter {
  async export(
    rows: OHLCVRow[] | AsyncIterable<OHLCVRow>,
    outputPath: string
  ): Promise<{ rowCount: number }> {
    return exportParquet(rows, outputPath);
  }
}
