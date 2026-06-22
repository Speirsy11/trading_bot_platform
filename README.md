# Crypto Trading Bot Platform

A crypto trading bot platform for building strategies, backtesting them against
historical candle data, and running them as paper or live bots. Built as a
TypeScript monorepo with a typed end-to-end stack (Next.js + tRPC + Drizzle +
TimescaleDB + BullMQ).

> **Status:** functional locally — backtesting, paper trading, research sweeps,
> and market-data browsing all work against a populated database. Live trading
> is gated behind safeguards and should be treated as experimental. See
> [docs/plans/CURRENT_STATE_AND_ROADMAP.md](docs/plans/CURRENT_STATE_AND_ROADMAP.md).

## Product Focus

The app is centred on three workflows:

1. **Strategies** — browse templates, edit parameters and risk presets, then
   launch research or bot runs.
2. **Backtesting** — validate the exact strategy config against historical
   OHLCV candles before risking capital.
3. **Live Runs** — run algorithms in paper mode first, then real crypto mode
   through configured exchange credentials.

See [docs/TRADING_PLATFORM_FOCUS.md](docs/TRADING_PLATFORM_FOCUS.md) for the
competitive baseline and product direction.

## Architecture

A pnpm + Turborepo monorepo.

```
apps/
  web        Next.js dashboard (strategies, backtests, bots, research, market data)
  api        Fastify + tRPC API and BullMQ worker process

packages/
  trading-core   Strategies, backtest engine, bot runtime, risk + order management
  indicators     Technical indicators (SMA/EMA/RSI/MACD/ATR/Bollinger/…) with fixtures
  data-pipeline  Data export utilities (CSV / SQLite / Parquet) used by the export worker
  db             Drizzle schema, migrations, seeds, queries (TimescaleDB hypertables)
  types          Shared domain types
  utils          Shared utilities
  config         Runtime configuration
  sdk            Generated client SDK
  tbp-cli        Command-line tool
```

See [docs/plans/00-ARCHITECTURE.md](docs/plans/00-ARCHITECTURE.md) for full
details.

## Quick Start

```bash
cp .env.example .env   # then fill in the required values (see Configuration)
pnpm install
pnpm docker:up         # Start Postgres + Redis
pnpm db:migrate        # Run database migrations
pnpm dev               # Start all apps
```

The web app runs on <http://localhost:3000> and the API on <http://localhost:3001>.

### Configuration

The required environment variables are documented in [`.env.example`](.env.example).
The two you must set before anything works:

| Variable                        | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`                  | Platform Postgres/TimescaleDB (bots, backtests, research, settings). |
| `SIGNAL_HARVESTER_DATABASE_URL` | Read-only market-data source (see **Market Data** below).            |
| `ENCRYPTION_KEY`                | 32-byte hex key used to encrypt stored exchange API credentials.     |

Generate an encryption key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Market Data

The platform is **read-only for market data**. It does not collect or own OHLCV
candles itself — it reads canonical candle data from an external **Signal
Harvester** Postgres database, configured via `SIGNAL_HARVESTER_DATABASE_URL`.
The harvester owns ingestion, backfill, gap detection, and repair; the trading
platform only queries the candles it needs for charts, backtests, and bot runs.

Because of this, the `dataCollection.backfill` and `dataCollection.detectGaps`
endpoints intentionally return `{ disabled: true }` — those responsibilities
live in Signal Harvester, not here. The remaining `dataCollection` endpoints
(`status`, `getConfig`, `getQualityMetrics`, `events`, `queueStats`) are
read/monitoring only.

```
Signal Harvester DB  ──(read-only)──▶  MarketDataReader  ──▶  charts / backtests / bots
   (market_data_points)                 (HarvesterPostgresMarketDataReader)
```

### Local development without a harvester

For tests and local fixtures you can fall back to candles stored in the
platform's own `ohlcv` table by setting `MARKET_DATA_ALLOW_LOCAL_FALLBACK=true`
(automatically enabled when `NODE_ENV=test`). In that mode the platform reads
from `LocalDrizzleMarketDataReader` instead of the harvester. This is for
development only — production runs should always point at a real harvester DB.

## Background Workers

The API ships a separate worker process (`pnpm --filter api dev:workers`, or the
`workers` Docker service) that runs BullMQ-backed jobs. It does **not** collect
market data. It runs:

| Worker          | Responsibility                                          |
| --------------- | ------------------------------------------------------- |
| Bot executor    | Drives running paper/live bots tick by tick.            |
| Backtest runner | Executes queued backtests against historical candles.   |
| Research runner | Runs strategy parameter sweeps and promotion workflows. |
| Data export     | Generates CSV/SQLite exports of stored data.            |
| Data retention  | Purges old `bot_logs` and `ohlcv` rows on a schedule.   |

A minimal worker health server listens on `:3002` (`GET /health`).

To run the workers detached in Docker:

```bash
pnpm docker:workers:up    # build + start the bootstrap and workers containers
pnpm docker:workers:logs  # tail their logs
pnpm docker:workers:down  # stop them
```

## Scripts

| Command             | Description                            |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Start all apps in development mode     |
| `pnpm build`        | Build all packages and apps            |
| `pnpm lint`         | Lint all packages                      |
| `pnpm type-check`   | TypeScript type checking               |
| `pnpm test`         | Run all tests                          |
| `pnpm format`       | Format all files with Prettier         |
| `pnpm db:migrate`   | Run database migrations                |
| `pnpm db:seed`      | Seed default settings                  |
| `pnpm docker:up`    | Start infrastructure (Postgres, Redis) |
| `pnpm docker:down`  | Stop infrastructure                    |
| `pnpm docker:reset` | Reset infrastructure (nuke volumes)    |

## Testing

```bash
pnpm test         # full suite across the workspace
pnpm test:ci      # CI variant (requires Postgres + Redis services)
```

Most unit tests run without external services. Integration tests that need a
database or Redis are skipped unless those services are available (see the CI
workflow in `.github/workflows/ci.yml`).

UI changes should be verified with screenshots — see [AGENTS.md](AGENTS.md) for
the `pnpm --filter web ui:verify` workflow.

## License

MIT — see [LICENSE](LICENSE).
