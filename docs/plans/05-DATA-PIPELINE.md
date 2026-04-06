# Market Data Pipeline — Development Plan

## Agent System Prompt

```
You are a senior data engineer specialising in real-time and batch data pipelines for
financial market data. You have deep expertise in time-series databases (TimescaleDB),
message queues (BullMQ/Redis), exchange API integration (CCXT), and building reliable
data collection systems that handle rate limits, gaps, and failures gracefully. You
work with TypeScript in a Turborepo monorepo. You follow test-driven development and
design for data quality — validation, deduplication, and gap detection are as important
as collection itself. You also design data export systems that produce portable,
well-structured datasets.
```

---

## Task Prompt

```
Your task is to build the data pipeline and database layer for the crypto trading bot
platform. This is Phase 2 — the monorepo scaffolding (03-INFRASTRUCTURE.md) has already
been completed. You have a working Turborepo with stub packages, Docker Compose running
TimescaleDB + Redis, and all shared configs in place.

Specifically, you must:

1. Implement the @tb/db package fully:
   - Define ALL Drizzle ORM schemas listed in Section 3.2 (ohlcv, data_collection_status,
     data_exports, exchange_configs, bots, bot_trades, bot_logs, backtests,
     backtest_trades, settings). Follow the SQL definitions in Section 4 exactly.
   - Create a Drizzle database client (client.ts) using the postgres driver.
   - Create the initial Drizzle migration + raw SQL migrations for TimescaleDB features
     (hypertable creation, compression policies, indexes) as described in Section 15.
   - Create query helper functions for OHLCV data (insert, query by range, get latest
     timestamp, count candles) in queries/ohlcv.ts.
   - Write tests using Testcontainers against a real TimescaleDB instance.

2. Implement the @tb/data-pipeline package:
   - Build the full directory structure from Section 3.1.
   - OHLCVCollector: fetches candles from CCXT, implements incremental updates (Section 6.2),
     respects rate limits.
   - CandleValidator: all 8 validation rules from Section 9.1.
   - Deduplicator: relies on database-level UPSERT (Section 9.2).
   - GapDetector: finds missing candles and queues backfill jobs (Section 9.3).
   - BackfillManager + BackfillJob: historical data download with prioritisation (Section 7).
   - ExchangeRateLimiter: sliding window per-exchange rate limiting using Redis (Section 5.2).
   - WebSocketManager + StreamProcessor: real-time data streams from exchanges (Section 8).
   - Export system: CSVExporter, ParquetExporter, SQLiteExporter with streaming cursors for
     large datasets (Section 10).

3. Set up the BullMQ job definitions and schedulers described in Section 11:
   - collect-ohlcv-1m (every 1 min)
   - collect-ohlcv-1h (every 1 hour)
   - detect-gaps (every 6 hours)
   - backfill (on-demand + hourly check)
   - export-data (on-demand)

4. Implement the default pair list from Section 6.4 as a configurable setting stored in
   the database.

5. All timestamps must be UTC (Section 12).

6. Write comprehensive tests (Section 13):
   - Unit tests for CandleValidator, GapDetector, ExchangeRateLimiter, all exporters.
   - Integration tests with Testcontainers for the full collection → validate → store → query
     cycle, UPSERT behaviour, gap detection, and export generation.
   - Create test fixtures: 1000 realistic BTC/USDT 1h candles, dataset with gaps, dataset
     with invalid candles, dataset with duplicates.

Follow TDD: write failing tests first, then implement. Every module should have
corresponding test coverage.

Refer to 00-ARCHITECTURE.md for shared interfaces and 03-INFRASTRUCTURE.md for the package
configuration patterns.

Do NOT build the API server routes or the frontend — those are handled by other agents.
Focus on the data layer and pipeline logic that other packages will consume.
```

---

## 1. Overview

Build the **data pipeline** — a set of packages and workers responsible for:

- **Continuous market data collection** — Background process that constantly downloads OHLCV data from exchanges and stores it in TimescaleDB
- **Historical data backfilling** — Efficiently download years of historical data for backtesting
- **Real-time data streaming** — WebSocket connections to exchanges for live price feeds
- **Data quality** — Validation, deduplication, gap detection, gap filling
- **Data export** — Generate downloadable datasets in CSV, Parquet, and SQLite formats
- **Database schema** — TimescaleDB schema design for efficient time-series storage and querying

This plan covers both the `@tb/data-pipeline` package and the `@tb/db` package's market data schemas.

---

## 2. Technology Stack

| Concern            | Library                                        | Notes                                                        |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------ |
| Exchange API       | **CCXT**                                       | Unified REST API for 150+ exchanges                          |
| Exchange WebSocket | **CCXT** `watch*` methods + native exchange WS | Real-time data feeds                                         |
| Database           | **PostgreSQL 16 + TimescaleDB**                | Hypertables, compression, automatic partitioning             |
| ORM                | **Drizzle ORM**                                | Type-safe queries; raw SQL for TimescaleDB-specific features |
| Job Queue          | **BullMQ**                                     | Scheduled data collection, backfill jobs, export jobs        |
| Rate Limiting      | **p-limit** + custom rate limiter              | Per-exchange rate limit management                           |
| CSV Generation     | **csv-stringify**                              | Streaming CSV generation                                     |
| Parquet            | **parquetjs** or **hyparquet**                 | Columnar format for analytics                                |
| SQLite Export      | **better-sqlite3**                             | Portable database export                                     |
| Compression        | **Node.js zlib** (built-in)                    | Gzip compression for exports                                 |
| Validation         | **Zod**                                        | Data validation schemas                                      |
| Date/Time          | **date-fns**                                   | Lightweight date manipulation                                |
| Testing            | **Vitest** + **Testcontainers**                | Test against real TimescaleDB                                |

---

## 3. Package Structure

### 3.1 `@tb/data-pipeline`

```
packages/data-pipeline/
├── src/
│   ├── index.ts                      # Public API exports
│   │
│   ├── collection/
│   │   ├── DataCollector.ts          # Main collection orchestrator
│   │   ├── OHLCVCollector.ts         # OHLCV-specific collection logic
│   │   ├── TickerCollector.ts        # Real-time ticker snapshots
│   │   └── FundingRateCollector.ts   # Futures funding rate collection
│   │
│   ├── backfill/
│   │   ├── BackfillManager.ts        # Orchestrate historical data download
│   │   ├── BackfillJob.ts            # Single backfill job logic
│   │   └── BackfillPrioritizer.ts    # Prioritize what to backfill first
│   │
│   ├── streaming/
│   │   ├── WebSocketManager.ts       # Manage exchange WS connections
│   │   ├── StreamProcessor.ts        # Process incoming WS messages
│   │   └── ReconnectHandler.ts       # Auto-reconnect with backoff
│   │
│   ├── validation/
│   │   ├── CandleValidator.ts        # OHLCV data validation rules
│   │   ├── Deduplicator.ts           # Prevent duplicate inserts
│   │   └── GapDetector.ts            # Find and report data gaps
│   │
│   ├── export/
│   │   ├── ExportManager.ts          # Export orchestration
│   │   ├── CSVExporter.ts            # CSV file generation
│   │   ├── ParquetExporter.ts        # Parquet file generation
│   │   ├── SQLiteExporter.ts         # SQLite database generation
│   │   └── CompressionHelper.ts      # gzip/zip compression
│   │
│   ├── rateLimit/
│   │   ├── ExchangeRateLimiter.ts    # Per-exchange rate limit tracking
│   │   └── RateLimitConfig.ts        # Rate limit defaults per exchange
│   │
│   └── types.ts                      # Pipeline-specific types
│
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

### 3.2 `@tb/db` (Market Data Schemas)

```
packages/db/
├── src/
│   ├── index.ts                      # Exports: db client, schemas, queries
│   ├── client.ts                     # Drizzle + postgres client setup
│   │
│   ├── schema/
│   │   ├── ohlcv.ts                  # OHLCV hypertable schema
│   │   ├── trades.ts                 # Trade/tick data schema
│   │   ├── orderBookSnapshots.ts     # Order book snapshots
│   │   ├── fundingRates.ts           # Funding rate data
│   │   ├── exchangeConfigs.ts        # Exchange API key storage
│   │   ├── bots.ts                   # Bot configuration & state
│   │   ├── botTrades.ts             # Executed bot trades
│   │   ├── botLogs.ts               # Bot event logs
│   │   ├── backtests.ts             # Backtest configs & results
│   │   ├── backtestTrades.ts        # Simulated backtest trades
│   │   ├── dataExports.ts           # Export job tracking
│   │   ├── dataCollection.ts        # Collection job metadata/status
│   │   └── settings.ts              # Key-value settings
│   │
│   ├── queries/
│   │   ├── ohlcv.ts                  # OHLCV query helpers
│   │   ├── bots.ts                   # Bot query helpers
│   │   └── exports.ts               # Export query helpers
│   │
│   ├── migrations/                   # Drizzle migrations
│   │   └── ...
│   │
│   └── seed/
│       └── development.ts            # Dev seed data
│
├── drizzle.config.ts
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Database Schema Design

### 4.1 OHLCV Hypertable

The main table for storing candlestick data. Uses TimescaleDB's hypertable feature for automatic time-based partitioning.

```sql
-- Key design decisions:
-- 1. TimescaleDB hypertable with 7-day chunks
-- 2. Composite unique constraint prevents duplicates
-- 3. Composite index optimized for backtesting queries
-- 4. Compression policy for data older than 30 days (90%+ size reduction)
-- 5. NUMERIC(20,8) for price precision (handles crypto's many decimal places)

CREATE TABLE ohlcv (
    time        TIMESTAMPTZ     NOT NULL,
    exchange    TEXT            NOT NULL,
    symbol      TEXT            NOT NULL,
    timeframe   TEXT            NOT NULL,
    open        NUMERIC(20, 8) NOT NULL,
    high        NUMERIC(20, 8) NOT NULL,
    low         NUMERIC(20, 8) NOT NULL,
    close       NUMERIC(20, 8) NOT NULL,
    volume      NUMERIC(20, 8) NOT NULL,
    trades_count BIGINT,
    created_at  TIMESTAMPTZ     DEFAULT NOW(),

    UNIQUE (exchange, symbol, timeframe, time)
);

SELECT create_hypertable('ohlcv', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

CREATE INDEX idx_ohlcv_lookup ON ohlcv (exchange, symbol, timeframe, time DESC);

-- Compression: 90%+ reduction for old data
ALTER TABLE ohlcv SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'time DESC',
    timescaledb.compress_segmentby = 'exchange,symbol,timeframe'
);
SELECT add_compression_policy('ohlcv', INTERVAL '30 days', if_not_exists => true);
```

### 4.2 Data Collection Metadata

Track what data we have, what's being collected, and what's missing:

```sql
CREATE TABLE data_collection_status (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange    TEXT NOT NULL,
    symbol      TEXT NOT NULL,
    timeframe   TEXT NOT NULL,
    earliest    TIMESTAMPTZ,          -- Earliest candle we have
    latest      TIMESTAMPTZ,          -- Latest candle we have
    total_candles BIGINT DEFAULT 0,
    gap_count   INT DEFAULT 0,
    status      TEXT DEFAULT 'idle',   -- idle, collecting, backfilling, error
    last_collected_at TIMESTAMPTZ,
    error_message TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (exchange, symbol, timeframe)
);
```

### 4.3 Data Export Records

```sql
CREATE TABLE data_exports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange    TEXT NOT NULL,
    symbols     TEXT[] NOT NULL,
    timeframe   TEXT NOT NULL,
    start_time  TIMESTAMPTZ NOT NULL,
    end_time    TIMESTAMPTZ NOT NULL,
    format      TEXT NOT NULL,           -- csv, parquet, sqlite
    compressed  BOOLEAN DEFAULT true,
    file_path   TEXT,                    -- Path to generated file
    file_size   BIGINT,                  -- File size in bytes
    row_count   BIGINT,
    status      TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
    progress    REAL DEFAULT 0,          -- 0-100
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

---

## 5. Data Sources & Rate Limits

### 5.1 Exchange Configuration

| Exchange     | OHLCV History | Rate Limit   | Max Candles/Request | WebSocket       | Notes                             |
| ------------ | ------------- | ------------ | ------------------- | --------------- | --------------------------------- |
| **Binance**  | 2017+         | 1200 req/min | 1000                | ✅ Stable       | Primary data source               |
| **Kraken**   | Years back    | 15 req/sec   | 720                 | ✅ Good         | Secondary source, good fiat pairs |
| **KuCoin**   | Varies        | 10 req/sec   | 1500                | ✅ Stable       | Altcoin coverage                  |
| **Bybit**    | Available     | 10 req/sec   | 200                 | ✅ Good         | Futures funding rates             |
| **Coinbase** | Limited       | 30 req/sec   | 300                 | ✅ Professional | Major pairs                       |

### 5.2 Rate Limiter Design

The rate limiter tracks requests per exchange and enforces limits:

```typescript
// Key design:
// - Sliding window rate limiting (not fixed window)
// - Per-exchange configuration
// - Shared across all workers via Redis (prevents exceeding limits with multiple workers)
// - Returns wait time if limit would be exceeded
// - Prioritizes live data over backfill
```

### 5.3 Free Third-Party APIs (Supplemental)

| Provider          | Use Case                                 | Limits                       |
| ----------------- | ---------------------------------------- | ---------------------------- |
| **CoinGecko**     | Daily OHLCV, market cap, metadata        | 50 req/min (no key required) |
| **CoinCap**       | Real-time prices, basic market data      | Unlimited (no key required)  |
| **CryptoCompare** | Hourly OHLCV, multi-exchange aggregation | 100 req/day                  |

These supplement exchange APIs. Do not rely on them for minute-level data.

---

## 6. Data Collection Architecture

### 6.1 Collection Flow

```
┌──────────────────────────────────────────────────────────────┐
│                BullMQ Scheduled Jobs                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ OHLCV 1m    │  │ OHLCV 1h     │  │ Backfill           │  │
│  │ every 1min  │  │ every 1hr    │  │ every 1hr          │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘  │
└─────────┼────────────────┼─────────────────────┼─────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Collector                              │
│  1. Check what's new (incremental)                         │
│  2. Apply rate limiter                                     │
│  3. Fetch via CCXT                                         │
│  4. Validate candles                                       │
│  5. Deduplicate                                            │
│  6. UPSERT into TimescaleDB                                │
│  7. Update collection metadata                             │
│  8. Publish to Redis pub/sub (for real-time dashboard)     │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Incremental Updates

The collector only downloads data that's newer than what we already have:

```
1. Query: SELECT MAX(time) FROM ohlcv WHERE exchange=? AND symbol=? AND timeframe=?
2. If result exists, fetch OHLCV since that time
3. If no result, start from a default lookback (e.g., 30 days ago)
4. Filter out the current incomplete candle (don't store ongoing candles)
5. UPSERT to handle any overlapping data cleanly
```

### 6.3 What to Collect by Default

**Auto-collection (background job):**

- Top 20 pairs by volume on each enabled exchange
- Timeframes: 1m, 5m, 15m, 1h, 4h, 1d
- Continuous: runs every minute for 1m data, every hour for hourly+

**On-demand (triggered when user configures a bot or backtest):**

- Additional pairs/timeframes as needed
- Historical backfill for date ranges not yet covered

### 6.4 Configurable Pair Lists

Store the list of pairs to collect in the database. The user can add/remove pairs via the dashboard settings. Default list:

```
BTC/USDT, ETH/USDT, BNB/USDT, SOL/USDT, XRP/USDT,
ADA/USDT, DOGE/USDT, AVAX/USDT, DOT/USDT, MATIC/USDT,
LINK/USDT, UNI/USDT, ATOM/USDT, LTC/USDT, FIL/USDT,
NEAR/USDT, APT/USDT, ARB/USDT, OP/USDT, SUI/USDT
```

---

## 7. Historical Data Backfilling

### 7.1 Strategy

Backfilling is the process of downloading historical data for the first time or filling gaps.

**Prioritization:**

1. Most recent data first (last 30 days) — needed for immediate backtesting
2. Then progressively older data (last 90 days, 1 year, 2 years, etc.)
3. Lower-priority timeframes last (1m data is huge but only needed for HFT strategies)

### 7.2 Batch Processing

- Each backfill job downloads one batch (e.g., 30 days of 1h data for one symbol).
- Jobs are broken into manageable chunks to avoid timeouts.
- Progress is tracked in the `data_collection_status` table.
- Multiple exchanges can be backfilled in parallel (different rate limit budgets).

### 7.3 Storage Estimates

For 20 pairs across 6 timeframes:

| Timeframe | Candles/Year/Pair | Storage/Year (20 pairs) | Compressed |
| --------- | ----------------- | ----------------------- | ---------- |
| 1m        | 525,600           | ~200 MB                 | ~20 MB     |
| 5m        | 105,120           | ~40 MB                  | ~4 MB      |
| 15m       | 35,040            | ~13 MB                  | ~1.3 MB    |
| 1h        | 8,760             | ~3.3 MB                 | ~330 KB    |
| 4h        | 2,190             | ~830 KB                 | ~83 KB     |
| 1d        | 365               | ~140 KB                 | ~14 KB     |
| **Total** |                   | **~257 MB**             | **~26 MB** |

With 5 years of data and 50 pairs: ~3.2 GB uncompressed, ~320 MB compressed.

This is very manageable even on modest hardware.

---

## 8. Real-Time Data Streaming

### 8.1 WebSocket Manager

Manages persistent WebSocket connections to exchanges for live data:

```typescript
// Key responsibilities:
// - Maintain WebSocket connections to enabled exchanges
// - Subscribe to ticker + kline streams for watched pairs
// - Auto-reconnect on disconnect (exponential backoff)
// - Publish incoming data to Redis pub/sub channels
// - Track connection health (heartbeats, latency)
```

### 8.2 Connection Management

- **One WebSocket connection per exchange** (multiplexed by the exchange)
- Binance: single WebSocket supports 1024 streams (more than enough)
- Re-subscribe on reconnect
- Health check interval: 30 seconds
- Max reconnection attempts: unlimited (exponential backoff up to 60s)

### 8.3 Data Flow

```
Exchange WebSocket
  → StreamProcessor (parse, normalize timestamps to UTC)
    → CandleValidator (quick validation)
      → Redis PUBLISH "market:candle" (for dashboard via Socket.IO)
      → Optional: batch INSERT into TimescaleDB (debounced, every 5 seconds)
```

**Important**: Real-time candle data from WebSocket is used for **dashboard display** and **live bot trading**. It is NOT used for the definitive OHLCV database — that's filled by the REST collection jobs which provide complete, finalized candles.

---

## 9. Data Validation

### 9.1 Validation Rules

Every candle is validated before storage:

| Rule                             | Severity | Description                             |
| -------------------------------- | -------- | --------------------------------------- |
| `high >= low`                    | Error    | High must be >= low                     |
| `open` within `[low, high]`      | Error    | Open must be within range               |
| `close` within `[low, high]`     | Error    | Close must be within range              |
| `volume >= 0`                    | Error    | Volume cannot be negative               |
| `time` is valid timestamp        | Error    | Timestamp must be valid and in the past |
| `O == H == L == C`               | Warning  | All-same values may indicate stale data |
| Price change > 20% in one candle | Warning  | Extreme movement flagged but stored     |
| Volume is zero on major pair     | Warning  | May indicate exchange downtime          |

Candles failing **error** rules are rejected. Candles with **warnings** are stored with a flag.

### 9.2 Deduplication

Database-level deduplication via `ON CONFLICT`:

```sql
INSERT INTO ohlcv (time, exchange, symbol, timeframe, open, high, low, close, volume)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (exchange, symbol, timeframe, time) DO UPDATE
SET open = EXCLUDED.open, high = EXCLUDED.high,
    low = EXCLUDED.low, close = EXCLUDED.close,
    volume = EXCLUDED.volume;
```

This handles both inserts and corrections seamlessly.

### 9.3 Gap Detection

Periodic job that scans for missing candles:

```
1. For each (exchange, symbol, timeframe) with status != 'idle':
2. Generate expected candle timestamps between earliest and latest
3. Query actual timestamps from database
4. Calculate missing = expected - actual
5. Update gap_count in data_collection_status
6. If gaps found:
   a. Queue backfill jobs to fill them
   b. Try alternative exchanges as fallback sources
   c. Log unfillable gaps (e.g., exchange was truly down)
```

Schedule: Run gap detection every 6 hours.

---

## 10. Data Export System

### 10.1 Export Formats

| Format      | Best For                                              | Library          | Compression             |
| ----------- | ----------------------------------------------------- | ---------------- | ----------------------- |
| **CSV**     | Spreadsheets, quick analysis, universal compatibility | `csv-stringify`  | gzip                    |
| **Parquet** | Big data tools, Python pandas, analytics              | `parquetjs`      | Snappy (built-in)       |
| **SQLite**  | Portable queryable database, sharing with others      | `better-sqlite3` | N/A (compact by nature) |

### 10.2 Export Flow

```
Dashboard: User configures export (exchange, symbols, timeframe, date range, format)
  → tRPC mutation: dataExport.create()
    → Insert record into data_exports table (status: "pending")
    → Add BullMQ job to export queue
      → Worker picks up job:
        1. Query TimescaleDB for requested data (streaming cursor for large datasets)
        2. Generate output file in requested format
        3. Compress if requested
        4. Save to /exports/{exportId}.{format}.gz
        5. Update data_exports record (status: "completed", file_path, file_size)
        6. Publish "export:completed" event
  → Dashboard polls or receives Socket.IO event
    → Download link becomes available
```

### 10.3 Export File Serving

Export files are stored in a local `/exports/` directory and served via Fastify's `@fastify/static` plugin. In production, these could be moved to S3 or similar.

### 10.4 Large Dataset Handling

For exports that could be hundreds of MB:

- Use **streaming cursors** (Drizzle + postgres driver) to avoid loading entire dataset into memory
- Write directly to a file stream (no buffering)
- Report progress as percentage of rows processed
- Allow cancellation of in-progress exports

---

## 11. Scheduling & Orchestration

### 11.1 BullMQ Job Definitions

| Job Name              | Queue             | Schedule                 | Priority | Concurrency |
| --------------------- | ----------------- | ------------------------ | -------- | ----------- |
| `collect-ohlcv-1m`    | `data-collection` | Every 1 min              | High     | 5           |
| `collect-ohlcv-1h`    | `data-collection` | Every 1 hour             | Medium   | 3           |
| `collect-ohlcv-daily` | `data-collection` | Every 1 hour             | Low      | 2           |
| `detect-gaps`         | `data-collection` | Every 6 hours            | Low      | 1           |
| `backfill`            | `data-backfill`   | On-demand + hourly check | Low      | 2           |
| `export-data`         | `data-export`     | On-demand                | Low      | 1           |

### 11.2 Job Retry Strategy

```typescript
{
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 2000,  // Start at 2 seconds, double each retry
  },
  removeOnComplete: { age: 86400 },  // Keep completed jobs for 24h
  removeOnFail: { age: 604800 },     // Keep failed jobs for 7 days
}
```

### 11.3 Monitoring

- BullMQ dashboard (Bull Board) for queue health visualization
- Log all collection errors with exchange, symbol, error type
- Track collection latency (time between candle close and storage)
- Alert if a symbol hasn't been collected for > 2× its expected interval

---

## 12. Timezone Handling

**Critical**: All timestamps are stored and processed in **UTC**.

- Exchange APIs return UTC timestamps (most crypto exchanges use UTC)
- TimescaleDB columns use `TIMESTAMPTZ` (stores with timezone awareness)
- JavaScript `Date` objects are converted to UTC before storage
- The dashboard handles display timezone conversion (local timezone)

```typescript
// Normalize any timestamp to UTC milliseconds
function toUTCMs(input: number | string | Date): number {
  return new Date(input).getTime();
}
```

---

## 13. Testing Strategy

### Unit Tests

| Component             | What to Test                                               |
| --------------------- | ---------------------------------------------------------- |
| `CandleValidator`     | Each validation rule with valid/invalid data               |
| `Deduplicator`        | Duplicate detection, near-duplicate handling               |
| `GapDetector`         | Gap detection with various missing patterns                |
| `ExchangeRateLimiter` | Rate limiting, wait time calculation, concurrent access    |
| `BackfillPrioritizer` | Priority ordering for different scenarios                  |
| `CSVExporter`         | Output format, correct column ordering, special characters |
| `ParquetExporter`     | Schema correctness, data types                             |
| `SQLiteExporter`      | Table creation, index creation, data integrity             |
| `CompressionHelper`   | Gzip compression/decompression roundtrip                   |

### Integration Tests (Testcontainers)

- Full collection cycle: fetch → validate → store → query
- UPSERT behavior: insert then update same candle
- Gap detection against real database with intentional gaps
- Export generation and re-import verification
- TimescaleDB hypertable creation and compression

### Test Data

Create fixtures with known datasets:

- 1000 candles of BTC/USDT 1h data (realistic values)
- Dataset with intentional gaps
- Dataset with invalid candles (high < low, negative volume)
- Dataset with duplicates

---

## 14. Dependencies to Install

```bash
# @tb/data-pipeline
ccxt                  # Exchange API
p-limit               # Concurrency limiter
csv-stringify          # CSV generation
better-sqlite3         # SQLite export
# parquetjs or hyparquet  # Parquet export (evaluate both)
zod                   # Validation
date-fns              # Date utilities
pino                  # Logging

# @tb/db
drizzle-orm           # ORM
postgres              # PostgreSQL driver (for Drizzle)
drizzle-kit           # Migration tooling

# Testing
vitest
@testcontainers/postgresql
```

---

## 15. Database Migration Notes

The Drizzle ORM won't handle TimescaleDB-specific features (hypertables, compression policies) natively. The approach:

1. Use Drizzle for table creation (columns, constraints, indexes)
2. Use raw SQL migrations for TimescaleDB features:
   - `create_hypertable()` calls
   - Compression policy setup
   - Retention policy setup
3. The `init-db/01-extensions.sql` file ensures TimescaleDB extension is available
4. Migration order: Drizzle migration → TimescaleDB setup SQL

This is standard practice when using TimescaleDB with any ORM.
