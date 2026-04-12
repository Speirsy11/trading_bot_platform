import { existsSync, readFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import type { OHLCVRow } from "@tb/db";
import parquet from "parquetjs-lite";
import { describe, it, expect, afterEach } from "vitest";

import { CSVExporter } from "../export/CSVExporter";
import { CompressionHelper } from "../export/CompressionHelper";
import { exportParquet, ParquetExporter } from "../export/ParquetExporter";
import { SQLiteExporter } from "../export/SQLiteExporter";

function createTestRows(count: number): OHLCVRow[] {
  const rows: OHLCVRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      time: new Date(`2024-01-01T${String(i).padStart(2, "0")}:00:00Z`),
      exchange: "binance",
      symbol: "BTC/USDT",
      timeframe: "1h",
      open: "42000.00000000",
      high: "42500.00000000",
      low: "41800.00000000",
      close: "42300.00000000",
      volume: "500.00000000",
      tradesCount: 1000,
      createdAt: new Date(),
    });
  }
  return rows;
}

describe("CSVExporter", () => {
  const testDir = join(tmpdir(), "tb-test-csv-" + Date.now());

  it("exports OHLCV data to CSV", async () => {
    mkdirSync(testDir, { recursive: true });
    const exporter = new CSVExporter();
    const outputPath = join(testDir, "test.csv");
    const rows = createTestRows(5);

    const result = await exporter.export(rows, outputPath);

    expect(result.rowCount).toBe(5);
    expect(existsSync(outputPath)).toBe(true);

    const content = readFileSync(outputPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(6); // header + 5 rows
    expect(lines[0]).toContain("time");
    expect(lines[0]).toContain("exchange");

    rmSync(testDir, { recursive: true, force: true });
  });

  it("handles empty dataset", async () => {
    mkdirSync(testDir, { recursive: true });
    const exporter = new CSVExporter();
    const outputPath = join(testDir, "empty.csv");

    const result = await exporter.export([], outputPath);
    expect(result.rowCount).toBe(0);

    rmSync(testDir, { recursive: true, force: true });
  });
});

describe("SQLiteExporter", () => {
  const testDir = join(tmpdir(), "tb-test-sqlite-" + Date.now());

  it("exports OHLCV data to SQLite", async () => {
    mkdirSync(testDir, { recursive: true });
    const exporter = new SQLiteExporter();
    const outputPath = join(testDir, "test.sqlite");
    const rows = createTestRows(5);

    const result = await exporter.export(rows, outputPath);

    expect(result.rowCount).toBe(5);
    expect(existsSync(outputPath)).toBe(true);

    rmSync(testDir, { recursive: true, force: true });
  });
});

describe("ParquetExporter", () => {
  const testDir = join(tmpdir(), "tb-test-parquet-" + Date.now());

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("exports OHLCV data to Parquet and reads back correct row count", async () => {
    mkdirSync(testDir, { recursive: true });
    const outputPath = join(testDir, "test.parquet");
    const rows = createTestRows(7);

    const result = await exportParquet(rows, outputPath);

    expect(result.rowCount).toBe(7);
    expect(existsSync(outputPath)).toBe(true);

    // Read back with parquetjs-lite and count rows
    const reader = await parquet.ParquetReader.openFile(outputPath);
    const cursor = reader.getCursor();
    let readCount = 0;
    let firstRow: Record<string, unknown> | null = null;
    while (true) {
      const row = await cursor.next();
      if (row === null) break;
      if (firstRow === null) firstRow = row;
      readCount++;
    }
    await reader.close();

    expect(readCount).toBe(7);
    expect(firstRow).not.toBeNull();

    // Round-trip check: timestamp and close value
    // parquetjs-lite decodes INT64 as BigInt; convert to Number for comparison
    const ts = firstRow!["time"];
    const tsMs =
      typeof ts === "bigint" ? Number(ts) : ts instanceof Date ? ts.getTime() : Number(ts);
    expect(tsMs).toBe(new Date("2024-01-01T00:00:00Z").getTime());

    expect(Number(firstRow!["close"])).toBeCloseTo(42300.0, 2);
    expect(firstRow!["exchange"]).toBe("binance");
    expect(firstRow!["symbol"]).toBe("BTC/USDT");
  });

  it("exports OHLCV data via ParquetExporter class wrapper", async () => {
    mkdirSync(testDir, { recursive: true });
    const exporter = new ParquetExporter();
    const outputPath = join(testDir, "test-class.parquet");
    const rows = createTestRows(5);

    const result = await exporter.export(rows, outputPath);

    expect(result.rowCount).toBe(5);
    expect(existsSync(outputPath)).toBe(true);
  });

  it("handles async iterable source (streaming, no full buffer)", async () => {
    mkdirSync(testDir, { recursive: true });
    const outputPath = join(testDir, "test-async.parquet");

    async function* rowGenerator(): AsyncGenerator<OHLCVRow> {
      for (const row of createTestRows(10)) {
        yield row;
      }
    }

    const result = await exportParquet(rowGenerator(), outputPath);
    expect(result.rowCount).toBe(10);
    expect(existsSync(outputPath)).toBe(true);

    // Verify the file can be read back
    const reader = await parquet.ParquetReader.openFile(outputPath);
    const cursor = reader.getCursor();
    let count = 0;
    while ((await cursor.next()) !== null) count++;
    await reader.close();
    expect(count).toBe(10);
  });
});

describe("CompressionHelper", () => {
  const testDir = join(tmpdir(), "tb-test-compress-" + Date.now());

  it("gzip and gunzip roundtrip works", async () => {
    mkdirSync(testDir, { recursive: true });
    const inputPath = join(testDir, "input.txt");
    const gzPath = join(testDir, "input.txt.gz");
    const outputPath = join(testDir, "output.txt");

    const originalContent = "Hello, world! ".repeat(1000);
    const { writeFileSync } = await import("fs");
    writeFileSync(inputPath, originalContent);

    await CompressionHelper.gzipFile(inputPath, gzPath);
    expect(existsSync(gzPath)).toBe(true);

    await CompressionHelper.gunzipFile(gzPath, outputPath);
    const decompressed = readFileSync(outputPath, "utf-8");
    expect(decompressed).toBe(originalContent);

    rmSync(testDir, { recursive: true, force: true });
  });
});
