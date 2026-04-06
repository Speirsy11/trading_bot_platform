import { mkdirSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  ohlcv,
  dataCollectionStatus,
  settings,
  dataExports,
  exchangeConfigs,
  bots,
  botTrades,
  botLogs,
  backtests,
  backtestTrades,
  upsertOHLCV,
  queryOHLCVByRange,
  type OHLCVInsert,
} from "@tb/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { CSVExporter } from "../export/CSVExporter";
import { SQLiteExporter } from "../export/SQLiteExporter";
import { GapDetector } from "../validation/GapDetector";

import { generateRealisticCandles } from "./fixtures";

const schema = {
  ohlcv,
  dataCollectionStatus,
  settings,
  dataExports,
  exchangeConfigs,
  bots,
  botTrades,
  botLogs,
  backtests,
  backtestTrades,
};

describe("Data Pipeline Integration Tests", () => {
  let container: StartedPostgreSqlContainer;
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16").start();
    client = postgres(container.getConnectionUri());
    db = drizzle(client, { schema });

    await client.unsafe(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE ohlcv (
        time TIMESTAMPTZ NOT NULL,
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        open NUMERIC(20, 8) NOT NULL,
        high NUMERIC(20, 8) NOT NULL,
        low NUMERIC(20, 8) NOT NULL,
        close NUMERIC(20, 8) NOT NULL,
        volume NUMERIC(20, 8) NOT NULL,
        trades_count BIGINT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (exchange, symbol, timeframe, time)
      );
      CREATE INDEX idx_ohlcv_lookup ON ohlcv (exchange, symbol, timeframe, time DESC);

      CREATE TABLE data_collection_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        earliest TIMESTAMPTZ,
        latest TIMESTAMPTZ,
        total_candles BIGINT DEFAULT 0,
        gap_count INT DEFAULT 0,
        status TEXT DEFAULT 'idle',
        last_collected_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (exchange, symbol, timeframe)
      );

      CREATE TABLE settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }, 120_000);

  afterAll(async () => {
    await client.end();
    await container.stop();
  });

  describe("full collection → validate → store → query cycle", () => {
    it("stores and retrieves candle data correctly", async () => {
      const candles = generateRealisticCandles(50);
      const rows: OHLCVInsert[] = candles.map((c) => ({
        time: new Date(c.time),
        exchange: "binance",
        symbol: "BTC/USDT",
        timeframe: "1h",
        open: c.open.toString(),
        high: c.high.toString(),
        low: c.low.toString(),
        close: c.close.toString(),
        volume: c.volume.toString(),
      }));

      await upsertOHLCV(db, rows);

      const result = await queryOHLCVByRange(
        db,
        "binance",
        "BTC/USDT",
        "1h",
        new Date(candles[0]!.time),
        new Date(candles[49]!.time)
      );

      expect(result).toHaveLength(50);
      expect(result[0]!.exchange).toBe("binance");
      expect(result[0]!.symbol).toBe("BTC/USDT");
    });
  });

  describe("UPSERT behaviour", () => {
    it("updates existing rows on conflict", async () => {
      const time = new Date("2025-01-01T00:00:00Z");

      // Insert initial
      await upsertOHLCV(db, [
        {
          time,
          exchange: "binance",
          symbol: "ETH/USDT",
          timeframe: "1h",
          open: "3000.00000000",
          high: "3100.00000000",
          low: "2900.00000000",
          close: "3050.00000000",
          volume: "100.00000000",
        },
      ]);

      // Upsert with updated values
      await upsertOHLCV(db, [
        {
          time,
          exchange: "binance",
          symbol: "ETH/USDT",
          timeframe: "1h",
          open: "3010.00000000",
          high: "3110.00000000",
          low: "2910.00000000",
          close: "3060.00000000",
          volume: "200.00000000",
        },
      ]);

      const result = await queryOHLCVByRange(db, "binance", "ETH/USDT", "1h", time, time);

      expect(result).toHaveLength(1);
      expect(result[0]!.open).toBe("3010.00000000");
      expect(result[0]!.volume).toBe("200.00000000");
    });
  });

  describe("gap detection", () => {
    it("detects missing candles", async () => {
      // Insert candles with intentional gap (skip hour 3 and 4)
      const exchange = "binance";
      const symbol = "SOL/USDT";
      const timeframe = "1h";
      const baseTime = new Date("2025-02-01T00:00:00Z");

      const rows: OHLCVInsert[] = [];
      for (let i = 0; i < 10; i++) {
        if (i === 3 || i === 4) continue; // Gap
        rows.push({
          time: new Date(baseTime.getTime() + i * 3_600_000),
          exchange,
          symbol,
          timeframe,
          open: "100.00000000",
          high: "110.00000000",
          low: "90.00000000",
          close: "105.00000000",
          volume: "500.00000000",
        });
      }

      await upsertOHLCV(db, rows);

      const detector = new GapDetector(db);
      const gaps = await detector.detectGaps(
        exchange,
        symbol,
        timeframe,
        baseTime,
        new Date(baseTime.getTime() + 9 * 3_600_000)
      );

      expect(gaps.length).toBe(1);
      expect(gaps[0]!.missingCount).toBe(2);
    });
  });

  describe("export generation", () => {
    const testDir = join(tmpdir(), "tb-integration-export-" + Date.now());

    it("exports stored data to CSV", async () => {
      mkdirSync(testDir, { recursive: true });

      const result = await queryOHLCVByRange(
        db,
        "binance",
        "BTC/USDT",
        "1h",
        new Date("2024-01-01T00:00:00Z"),
        new Date("2024-12-31T23:59:59Z")
      );

      const exporter = new CSVExporter();
      const outputPath = join(testDir, "btc_export.csv");
      const { rowCount } = await exporter.export(result, outputPath);

      expect(rowCount).toBeGreaterThan(0);
      expect(existsSync(outputPath)).toBe(true);

      rmSync(testDir, { recursive: true, force: true });
    });

    it("exports stored data to SQLite", async () => {
      mkdirSync(testDir, { recursive: true });

      const result = await queryOHLCVByRange(
        db,
        "binance",
        "BTC/USDT",
        "1h",
        new Date("2024-01-01T00:00:00Z"),
        new Date("2024-12-31T23:59:59Z")
      );

      const exporter = new SQLiteExporter();
      const outputPath = join(testDir, "btc_export.sqlite");
      const { rowCount } = await exporter.export(result, outputPath);

      expect(rowCount).toBeGreaterThan(0);
      expect(existsSync(outputPath)).toBe(true);

      rmSync(testDir, { recursive: true, force: true });
    });
  });
});
