import { existsSync, readFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import type { OHLCVRow } from "@tb/db";
import { describe, it, expect } from "vitest";

import { CSVExporter } from "../export/CSVExporter";
import { CompressionHelper } from "../export/CompressionHelper";
import { ParquetExporter } from "../export/ParquetExporter";
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

  it("exports OHLCV data to JSONL", async () => {
    mkdirSync(testDir, { recursive: true });
    const exporter = new ParquetExporter();
    const outputPath = join(testDir, "test.jsonl");
    const rows = createTestRows(5);

    const result = await exporter.export(rows, outputPath);

    expect(result.rowCount).toBe(5);
    expect(existsSync(outputPath)).toBe(true);

    const content = readFileSync(outputPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(5);

    // Verify each line is valid JSON
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.exchange).toBe("binance");
    expect(parsed.symbol).toBe("BTC/USDT");

    rmSync(testDir, { recursive: true, force: true });
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
