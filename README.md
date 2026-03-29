# Crypto Trading Bot Platform

A personal crypto trading bot platform with backtesting, live trading, and a monitoring dashboard.

## Quick Start

```bash
cp .env.example .env.local
pnpm install
pnpm docker:up        # Start Postgres + Redis
pnpm db:migrate       # Run database migrations
pnpm dev              # Start all apps
```

## Architecture

See [docs/plans/00-ARCHITECTURE.md](docs/plans/00-ARCHITECTURE.md) for full details.

## Scripts

| Command             | Description                            |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Start all apps in development mode     |
| `pnpm build`        | Build all packages and apps            |
| `pnpm lint`         | Lint all packages                      |
| `pnpm type-check`   | TypeScript type checking               |
| `pnpm test`         | Run all tests                          |
| `pnpm format`       | Format all files with Prettier         |
| `pnpm docker:up`    | Start infrastructure (Postgres, Redis) |
| `pnpm docker:down`  | Stop infrastructure                    |
| `pnpm docker:reset` | Reset infrastructure (nuke volumes)    |
