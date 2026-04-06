# Crypto Trading Bot Platform

A personal crypto trading bot platform with backtesting, live trading, and a monitoring dashboard.

## Quick Start

```bash
cp .env.example .env
pnpm install
pnpm docker:up        # Start Postgres + Redis
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed default collection config
pnpm dev              # Start all apps
```

To run background data collection in Docker without keeping a terminal open:

```bash
pnpm docker:ingest:up
```

To run workers directly on the host instead:

```bash
pnpm --filter api dev:workers
```

## Architecture

See [docs/plans/00-ARCHITECTURE.md](docs/plans/00-ARCHITECTURE.md) for full details.

## Scripts

| Command                   | Description                                   |
| ------------------------- | --------------------------------------------- |
| `pnpm dev`                | Start all apps in development mode            |
| `pnpm build`              | Build all packages and apps                   |
| `pnpm lint`               | Lint all packages                             |
| `pnpm type-check`         | TypeScript type checking                      |
| `pnpm test`               | Run all tests                                 |
| `pnpm format`             | Format all files with Prettier                |
| `pnpm docker:up`          | Start infrastructure (Postgres, Redis)        |
| `pnpm docker:down`        | Stop infrastructure                           |
| `pnpm docker:reset`       | Reset infrastructure (nuke volumes)           |
| `pnpm docker:ingest:up`   | Build and start bootstrap + workers in Docker |
| `pnpm docker:ingest:logs` | Tail bootstrap + worker logs                  |
| `pnpm docker:ingest:down` | Stop the detached worker container            |
| `pnpm db:seed`            | Seed default collection config                |

---

## Data Ingestion Guide

Charts and dashboards start empty because market data must be collected from exchanges. The platform handles this automatically once set up.

### How it works

The platform collects OHLCV (Open/High/Low/Close/Volume) candlestick data from cryptocurrency exchanges via the [CCXT](https://github.com/ccxt/ccxt) library. The pipeline is:

```
Worker startup → reads settings table → registers BullMQ repeatable jobs
  → OHLCVCollector fetches candles from exchange REST API (CCXT)
    → CandleValidator validates each candle (8 rules)
      → Drizzle UPSERT into TimescaleDB ohlcv hypertable
        → Redis pub/sub event → WebSocket → dashboard updates
```

Data is stored in a TimescaleDB hypertable keyed by `(exchange, symbol, timeframe, time)`. The collector works incrementally — it finds the latest candle already stored and only fetches newer data.

### Step-by-step: Getting data flowing

#### 1. Prerequisites

```bash
cp .env.example .env

# Generate an encryption key and add it to .env:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Then set ENCRYPTION_KEY=<output> in .env

pnpm install
pnpm docker:up
pnpm db:migrate
```

#### 2. Seed the database

```bash
pnpm db:seed
```

This inserts default collection configuration into the `settings` table:

| Key                     | Default value                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `collection.pairs`      | BTC/USDT, ETH/USDT, BNB/USDT, SOL/USDT, XRP/USDT, ADA/USDT, DOGE/USDT, AVAX/USDT, DOT/USDT, MATIC/USDT, LINK/USDT, UNI/USDT, ATOM/USDT, LTC/USDT, FIL/USDT, NEAR/USDT, APT/USDT, ARB/USDT, OP/USDT, SUI/USDT |
| `collection.timeframes` | 1m, 5m, 15m, 1h, 4h, 1d                                                                                                                                                                                      |
| `collection.exchanges`  | binance                                                                                                                                                                                                      |

#### 3. Start the workers

Preferred detached option:

```bash
pnpm docker:ingest:up
```

This starts two Compose services under the `ingest` profile:

1. `bootstrap` runs database migrations and seeds the default collection config if it is missing
2. `workers` starts the BullMQ worker process in a long-running container with `restart: unless-stopped`

Useful commands:

```bash
pnpm docker:ingest:logs
pnpm docker:ingest:down
```

Host-based option:

```bash
pnpm --filter api dev:workers
```

On startup, the workers automatically:

1. Read `collection.pairs`, `collection.timeframes`, and `collection.exchanges` from the `settings` table
2. Register repeatable BullMQ jobs for each exchange/pair combination
3. Schedule gap detection jobs for every exchange/pair/timeframe combination
4. Begin processing collection jobs immediately

You should see log lines like:

```
Scheduling collection: 1 exchange(s), 20 pair(s), 6 timeframe(s)
Repeatable data-collection jobs registered.
{"name":"data-collector","exchange":"binance","symbol":"BTC/USDT","timeframe":"1m","inserted":500,"msg":"OHLCV data collected"}
```

| Job                | Schedule         | What it does                                    |
| ------------------ | ---------------- | ----------------------------------------------- |
| `collect-ohlcv-1m` | Every 60 seconds | Fetches latest 1-minute candles for each pair   |
| `collect-ohlcv-1h` | Every hour       | Fetches latest 1h, 4h, 1d candles for each pair |
| `detect-gaps`      | Every 6 hours    | Finds missing candles and reports gap count     |

#### 4. (Optional) Backfill historical data

The recurring jobs only collect **new** candles going forward. To fill in historical data for backtesting, use the `dataCollection.backfill` tRPC endpoint or submit directly via the API:

```bash
# Via curl against the running API server (default port 3001):
curl -X POST http://localhost:3001/trpc/dataCollection.backfill \
  -H "Content-Type: application/json" \
  -d '{"json":{"exchange":"binance","symbol":"BTC/USDT","timeframe":"1h","startTime":"2024-01-01T00:00:00Z","endTime":"2025-12-31T23:59:59Z"}}'
```

Backfill fetches candles in batches (up to 1000 per request for Binance) and respects rate limits. A full year of 1h data takes under a minute.

### API endpoints for data collection

The `dataCollection` tRPC router provides these endpoints:

| Endpoint                    | Type     | Description                                     |
| --------------------------- | -------- | ----------------------------------------------- |
| `dataCollection.status`     | query    | Get collection status for all or specific pairs |
| `dataCollection.getConfig`  | query    | Get current collection config from settings     |
| `dataCollection.backfill`   | mutation | Queue a historical backfill job                 |
| `dataCollection.detectGaps` | mutation | Trigger gap detection for a specific pair       |
| `dataCollection.queueStats` | query    | Get BullMQ queue job counts for monitoring      |

### Architecture summary

```
┌─────────────────────────────────────────────────────────┐
│ settings table                                          │
│  collection.pairs / collection.timeframes / exchanges   │
└────────────────────────────┬────────────────────────────┘
                             │ (read on worker startup)
                             ▼
┌─────────────────────────────────────────────────────────┐
│ BullMQ Repeatable Jobs (stored in Redis)                │
│  collect-ohlcv-1m  (every 60s per exchange/pair)        │
│  collect-ohlcv-1h  (every 1h for 1h/4h/1d)             │
│  detect-gaps       (every 6h)                           │
└────────────────────────────┬────────────────────────────┘
                             │ (triggers workers)
                             ▼
┌─────────────────────────────────────────────────────────┐
│ Workers  (pnpm --filter api dev:workers)                │
│  collectionWorker → OHLCVCollector → CCXT fetchOHLCV()  │
│  backfillWorker   → BackfillManager → historical fetch  │
│  exportWorker     → CSV/Parquet/SQLite generation       │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ TimescaleDB  (ohlcv hypertable)                         │
│  UPSERT on (exchange, symbol, timeframe, time)          │
│  → Compression policies, automatic partitioning         │
└─────────────────────────────────────────────────────────┘
```

### What's not yet implemented

| Gap                 | Details                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| WebSocket streaming | `WebSocketManager` code exists in the data-pipeline package but isn't integrated with the workers yet |

### Options for getting data faster

1. **Smallest footprint** — Edit `collection.pairs` in the settings table to 1–3 pairs. Workers will only collect those.
2. **Backfill for backtesting** — Use `dataCollection.backfill` for the pairs/timeframes/date ranges you want. A year of 1h data for one pair takes under a minute.
3. **Full collection** — The default seed has 20 pairs across all 6 timeframes. Workers schedule all of them automatically and handle rate limits.
