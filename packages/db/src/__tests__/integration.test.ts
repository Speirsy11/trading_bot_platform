import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
  countCandles,
  getLatestTimestamp,
  insertOHLCV,
  queryOHLCVByRange,
  upsertOHLCV,
} from "../queries/ohlcv";
import * as backtestTradesSchema from "../schema/backtestTrades";
import * as backtestsSchema from "../schema/backtests";
import * as botLogsSchema from "../schema/botLogs";
import * as botTradesSchema from "../schema/botTrades";
import * as botsSchema from "../schema/bots";
import * as dataCollectionSchema from "../schema/dataCollection";
import * as dataExportsSchema from "../schema/dataExports";
import * as exchangeConfigsSchema from "../schema/exchangeConfigs";
import * as ohlcvSchema from "../schema/ohlcv";
import type { OHLCVInsert } from "../schema/ohlcv";
import * as settingsSchema from "../schema/settings";

// Use a plain Postgres container (TimescaleDB not available in default testcontainers)
// We test schema creation and queries; TimescaleDB-specific features tested separately
const hasDocker = await (async () => {
  try {
    const { execSync } = await import("child_process");
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasDocker)("@tb/db integration tests", () => {
  let container: StartedPostgreSqlContainer;
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16").start();
    client = postgres(container.getConnectionUri());
    db = drizzle(client, {
      schema: {
        ...ohlcvSchema,
        ...dataCollectionSchema,
        ...dataExportsSchema,
        ...exchangeConfigsSchema,
        ...botsSchema,
        ...botTradesSchema,
        ...botLogsSchema,
        ...backtestsSchema,
        ...backtestTradesSchema,
        ...settingsSchema,
      },
    });

    // Create tables
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

      CREATE TABLE data_exports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exchange TEXT NOT NULL,
        symbols TEXT[] NOT NULL,
        timeframe TEXT NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        format TEXT NOT NULL,
        compressed BOOLEAN DEFAULT true,
        file_path TEXT,
        file_size BIGINT,
        row_count BIGINT,
        status TEXT DEFAULT 'pending',
        progress REAL DEFAULT 0,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE exchange_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exchange TEXT NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT true,
        api_key TEXT,
        api_secret TEXT,
        passphrase TEXT,
        sandbox BOOLEAN DEFAULT false,
        metadata TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE bots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        strategy TEXT NOT NULL,
        strategy_params JSONB DEFAULT '{}',
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'backtest',
        status TEXT NOT NULL DEFAULT 'idle',
        risk_config JSONB DEFAULT '{}',
        current_balance NUMERIC(20, 8),
        total_pnl NUMERIC(20, 8),
        total_trades NUMERIC(20, 8),
        win_rate NUMERIC(5, 2),
        error_message TEXT,
        started_at TIMESTAMPTZ,
        stopped_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE bot_trades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        order_id TEXT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        type TEXT NOT NULL,
        amount NUMERIC(20, 8) NOT NULL,
        price NUMERIC(20, 8) NOT NULL,
        cost NUMERIC(20, 8) NOT NULL,
        fee NUMERIC(20, 8),
        fee_currency TEXT,
        pnl NUMERIC(20, 8),
        pnl_percent NUMERIC(10, 4),
        reason TEXT,
        executed_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE bot_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE backtests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        strategy TEXT NOT NULL,
        strategy_params JSONB DEFAULT '{}',
        exchange TEXT NOT NULL,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        initial_balance NUMERIC(20, 8) NOT NULL,
        final_balance NUMERIC(20, 8),
        total_pnl NUMERIC(20, 8),
        total_pnl_percent NUMERIC(10, 4),
        total_trades INT,
        winning_trades INT,
        losing_trades INT,
        win_rate NUMERIC(5, 2),
        max_drawdown NUMERIC(10, 4),
        sharpe_ratio NUMERIC(10, 4),
        profit_factor NUMERIC(10, 4),
        metrics JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        risk_config JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE backtest_trades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        backtest_id UUID NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        type TEXT NOT NULL,
        amount NUMERIC(20, 8) NOT NULL,
        price NUMERIC(20, 8) NOT NULL,
        cost NUMERIC(20, 8) NOT NULL,
        fee NUMERIC(20, 8),
        pnl NUMERIC(20, 8),
        pnl_percent NUMERIC(10, 4),
        balance NUMERIC(20, 8),
        reason TEXT,
        executed_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
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

  describe("OHLCV queries", () => {
    it("inserts OHLCV rows", async () => {
      const rows: OHLCVInsert[] = [
        {
          time: new Date("2024-01-01T00:00:00Z"),
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "1h",
          open: "42000.00000000",
          high: "42500.00000000",
          low: "41800.00000000",
          close: "42300.00000000",
          volume: "500.00000000",
        },
        {
          time: new Date("2024-01-01T01:00:00Z"),
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "1h",
          open: "42300.00000000",
          high: "42800.00000000",
          low: "42100.00000000",
          close: "42600.00000000",
          volume: "450.00000000",
        },
      ];

      const result = await insertOHLCV(db, rows);
      expect(result).toHaveLength(2);
    });

    it("queries OHLCV by range", async () => {
      const result = await queryOHLCVByRange(
        db,
        "binance",
        "BTC/USDT",
        "1h",
        new Date("2024-01-01T00:00:00Z"),
        new Date("2024-01-01T01:00:00Z")
      );
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("gets latest timestamp", async () => {
      const latest = await getLatestTimestamp(db, "binance", "BTC/USDT", "1h");
      expect(latest).not.toBeNull();
    });

    it("counts candles", async () => {
      const count = await countCandles(db, "binance", "BTC/USDT", "1h");
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("UPSERT updates existing candles", async () => {
      const updatedRows: OHLCVInsert[] = [
        {
          time: new Date("2024-01-01T00:00:00Z"),
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "1h",
          open: "42100.00000000", // Updated value
          high: "42600.00000000",
          low: "41900.00000000",
          close: "42400.00000000",
          volume: "600.00000000",
        },
      ];

      const result = await upsertOHLCV(db, updatedRows);
      expect(result).toHaveLength(1);
      expect(result[0]!.open).toBe("42100.00000000");

      // Count should remain the same
      const count = await countCandles(
        db,
        "binance",
        "BTC/USDT",
        "1h",
        new Date("2024-01-01T00:00:00Z"),
        new Date("2024-01-01T00:00:00Z")
      );
      expect(count).toBe(1);
    });

    it("returns empty for non-existent data", async () => {
      const result = await queryOHLCVByRange(
        db,
        "nonexistent",
        "BTC/USDT",
        "1h",
        new Date("2024-01-01T00:00:00Z"),
        new Date("2024-01-01T01:00:00Z")
      );
      expect(result).toHaveLength(0);
    });

    it("returns null for latest timestamp when no data", async () => {
      const latest = await getLatestTimestamp(db, "nonexistent", "BTC/USDT", "1h");
      expect(latest).toBeNull();
    });
  });

  describe("Settings table", () => {
    it("inserts and queries settings", async () => {
      await db.insert(settingsSchema.settings).values({
        key: "collection.pairs",
        value: JSON.stringify(["BTC/USDT", "ETH/USDT"]),
        description: "Default pairs",
      });

      const rows = await db
        .select()
        .from(settingsSchema.settings)
        .where(sql`${settingsSchema.settings.key} = 'collection.pairs'`);

      expect(rows).toHaveLength(1);
      const pairs = JSON.parse(rows[0]!.value);
      expect(pairs).toContain("BTC/USDT");
    });
  });
});
