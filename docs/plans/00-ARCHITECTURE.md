# Crypto Trading Bot Platform — Architecture Overview

> **Purpose**: This document provides the high-level architecture, technology decisions, and project structure for the entire platform. All other planning documents reference this as the source of truth for cross-cutting concerns.

---

## 1. Vision & Goals

Build a **personal crypto trading bot platform** that:

1. Runs trading bots against **historical data** for accurate backtesting.
2. Deploys those **same bots** on live markets with minimal code changes.
3. Supports **multiple exchanges** via configurable API keys.
4. Provides a **dashboard** for monitoring bots, individual trades, and overall portfolio performance.
5. Continuously **downloads and stores market data** locally, building a rich database that can also be exported.

### Non-Goals (for now)

- Multi-user / multi-tenant support.
- Mobile app.
- Social trading / copy trading.
- High-frequency trading (sub-second latency).

---

## 2. Hard Constraints

| Constraint       | Decision                                                                      |
| ---------------- | ----------------------------------------------------------------------------- |
| Monorepo         | **Turborepo** with **pnpm** workspaces                                        |
| Language         | **TypeScript** everywhere (strict mode)                                       |
| Containerisation | **Docker** + Docker Compose for local dev                                     |
| Testing          | **Test-driven development** — Vitest for unit/integration, Playwright for E2E |
| Cost             | Free APIs as much as possible; open-source everything                         |
| Priority         | Dev-first — runs locally with `docker compose up`; deployable later           |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DASHBOARD (Next.js)                      │
│                        apps/web                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Portfolio │ │ Bot Mgmt │ │ Backtest UI  │ │ Data Export  │   │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────┘   │
└────────────┬──────────────────────┬─────────────────────────────┘
             │  tRPC (type-safe)    │  WebSocket (real-time)
             ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API SERVER (Fastify)                        │
│                      apps/api                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ tRPC     │ │ WS Hub   │ │ Auth/Keys    │ │ Export API   │   │
│  │ Router   │ │          │ │ Mgmt         │ │              │   │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────┘   │
└──────┬──────────────┬───────────────┬───────────────────────────┘
       │              │               │
       ▼              ▼               ▼
┌─────────────┐ ┌───────────┐ ┌──────────────────────────────────┐
│  PostgreSQL │ │   Redis   │ │      BullMQ Workers              │
│  TimescaleDB│ │  Cache +  │ │  ┌───────────┐ ┌──────────────┐ │
│             │ │  Queues   │ │  │ Data       │ │ Bot          │ │
│  • OHLCV    │ │           │ │  │ Pipeline   │ │ Executor     │ │
│  • Trades   │ │           │ │  │ Worker     │ │ Worker       │ │
│  • Bot cfg  │ │           │ │  └───────────┘ └──────────────┘ │
│  • Portfolio│ │           │ │                                  │
└─────────────┘ └───────────┘ └──────────────────────────────────┘
                                       │
                              ┌────────┴────────┐
                              ▼                  ▼
                     ┌──────────────┐   ┌──────────────┐
                     │  CCXT        │   │  Exchange     │
                     │  (REST)      │   │  WebSockets   │
                     └──────────────┘   └──────────────┘
```

---

## 4. Monorepo Structure

```
trading-bot-platform/
├── apps/
│   ├── web/                    # Next.js dashboard (App Router)
│   └── api/                    # Fastify API server + WebSocket hub
│
├── packages/
│   ├── @tb/types               # Shared TypeScript types & interfaces
│   ├── @tb/utils               # Shared utility functions
│   ├── @tb/db                  # Drizzle ORM schemas, migrations, queries
│   ├── @tb/trading-core        # Backtesting engine, strategy interfaces, order management
│   ├── @tb/data-pipeline       # Market data collection, validation, storage
│   ├── @tb/indicators          # Technical indicator calculations (wraps tulind)
│   ├── @tb/config              # Zod-validated environment config
│   ├── @tb/eslint-config       # Shared ESLint flat config
│   └── @tb/tsconfig            # Shared TypeScript configs
│
├── docker/
│   ├── docker-compose.yml      # Local dev: Postgres, Redis, TimescaleDB
│   ├── docker-compose.prod.yml # Production override
│   ├── Dockerfile.api          # Multi-stage build for API
│   └── Dockerfile.web          # Multi-stage build for dashboard
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

### Package Naming Convention

All internal packages use the `@tb/` scope (short for "trading bot") to keep imports clean:

```typescript
import type { Candle, Order } from "@tb/types";
import { calculateSMA } from "@tb/indicators";
import { db } from "@tb/db";
```

---

## 5. Technology Stack

### Core

| Layer         | Technology                      | Rationale                                                                                                              |
| ------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Frontend      | **Next.js 15** (App Router)     | Best Turborepo integration, SSR for initial load, client-heavy for real-time                                           |
| Backend       | **Fastify**                     | Fastest Node.js framework, native WebSocket via `@fastify/websocket`, plugin architecture                              |
| Database      | **PostgreSQL 16 + TimescaleDB** | TimescaleDB hypertables for OHLCV time-series (90%+ compression, automatic partitioning); Postgres for relational data |
| ORM           | **Drizzle ORM**                 | Type-safe, minimal runtime overhead, excellent for performance-critical queries                                        |
| Cache / Queue | **Redis 7**                     | Shared caching layer + BullMQ job queue backend                                                                        |
| Job Queue     | **BullMQ**                      | Reliable distributed job processing with retry, scheduling, and dashboard                                              |
| Exchange API  | **CCXT**                        | Unified API across 150+ exchanges, built-in rate limiting, TypeScript support                                          |
| API Layer     | **tRPC**                        | End-to-end type safety between Next.js ↔ Fastify in the same monorepo                                                  |
| Real-time     | **Socket.IO**                   | Auto-reconnection, fallback to polling, room-based event channels                                                      |

### Frontend Stack

| Concern          | Technology                         | Rationale                                                               |
| ---------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| UI Components    | **shadcn/ui** (Radix + Tailwind)   | Copy-paste components, full control, dark mode, zero runtime overhead   |
| Charting         | **TradingView Lightweight Charts** | Purpose-built for financial candlestick charts, 16KB, real-time updates |
| Secondary Charts | **Apache ECharts**                 | Portfolio pie charts, area charts, heatmaps                             |
| State (client)   | **Zustand**                        | Lightweight (1.8KB), simple API for UI state                            |
| State (server)   | **TanStack Query**                 | Caching, refetching, optimistic updates for server data                 |
| Data Tables      | **TanStack Table**                 | Headless, type-safe, sorting/filtering/pagination                       |
| Dashboard Layout | **react-grid-layout**              | Draggable/resizable panels, used by Grafana                             |

### Testing Stack

| Level              | Technology                                                     |
| ------------------ | -------------------------------------------------------------- |
| Unit / Integration | **Vitest** (workspace config across all packages)              |
| Component          | **React Testing Library**                                      |
| E2E                | **Playwright**                                                 |
| API                | **Supertest**                                                  |
| Database           | **Testcontainers** (spin up Postgres in Docker per test suite) |

### DevOps

| Concern             | Technology                         |
| ------------------- | ---------------------------------- |
| Monorepo            | **Turborepo**                      |
| Package Manager     | **pnpm** (v9+)                     |
| Containerisation    | **Docker** + Docker Compose        |
| Bundling (packages) | **tsup**                           |
| Dev Server (API)    | **tsx** + **nodemon**              |
| Linting             | **ESLint 9** (flat config)         |
| Formatting          | **Prettier**                       |
| Pre-commit          | **Husky** + **lint-staged**        |
| Env Validation      | **Zod** (via `@tb/config`)         |
| Logging             | **Pino** (structured JSON logging) |

---

## 6. Key Data Flows

### 6.1 Market Data Collection (Background)

```
BullMQ Scheduler (cron)
  → Data Pipeline Worker
    → CCXT.fetchOHLCV() per exchange/symbol/timeframe
      → Validate & deduplicate
        → INSERT INTO TimescaleDB (UPSERT on conflict)
          → Publish event to Redis pub/sub
            → WebSocket hub fans out to dashboard
```

### 6.2 Backtesting

```
Dashboard: User configures backtest
  → tRPC mutation → API
    → BullMQ job: "run-backtest"
      → Trading-core package:
        1. Load historical data from TimescaleDB
        2. Create BacktestExchange (simulated)
        3. Instantiate Strategy
        4. Loop candles: strategy.onCandle() → simulated orders
        5. Calculate performance metrics
      → Store results in DB
        → tRPC subscription / polling → Dashboard displays results
```

### 6.3 Live Trading

```
Dashboard: User starts bot (live mode)
  → tRPC mutation → API
    → BullMQ job: "start-bot"
      → Trading-core package:
        1. Create LiveExchange (CCXT instance with API keys)
        2. Instantiate same Strategy as backtest
        3. Subscribe to real-time candles via WebSocket
        4. strategy.onCandle() → real exchange orders via CCXT
        5. Log all trades to DB
      → Real-time updates via Socket.IO → Dashboard
```

### 6.4 Data Export

```
Dashboard: User requests export
  → tRPC mutation → API
    → BullMQ job: "export-data"
      → Query TimescaleDB for requested range
        → Generate CSV / Parquet / SQLite
          → Store in /exports/ directory
            → Return download URL via tRPC
```

---

## 7. Shared Interfaces (Preliminary)

These live in `@tb/types` and are the contracts between all packages:

```typescript
// Core market data
interface Candle {
  time: number; // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Exchange abstraction (same interface for backtest & live)
interface IExchange {
  fetchOHLCV(symbol: string, timeframe: string, since?: number, limit?: number): Promise<Candle[]>;
  createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number
  ): Promise<Order>;
  cancelOrder(id: string, symbol?: string): Promise<void>;
  fetchBalance(): Promise<Balance>;
  fetchOpenOrders(symbol?: string): Promise<Order[]>;
}

// Strategy contract
interface IStrategy {
  name: string;
  initialize(exchange: IExchange, config: StrategyConfig): Promise<void>;
  onCandle(candle: Candle, history: Candle[]): Promise<Signal>;
  cleanup(): Promise<void>;
}

// Bot configuration
interface BotConfig {
  id: string;
  name: string;
  strategy: string;
  strategyParams: Record<string, unknown>;
  exchange: string;
  symbol: string;
  timeframe: string;
  mode: "backtest" | "paper" | "live";
  riskConfig: RiskConfig;
}
```

---

## 8. Exchange Support

Primary exchanges (all free APIs, all supported by CCXT):

| Exchange     | Spot | Futures | Testnet | WebSocket | Notes                                               |
| ------------ | ---- | ------- | ------- | --------- | --------------------------------------------------- |
| **Binance**  | ✅   | ✅      | ✅      | ✅        | Highest liquidity, best data depth, data from 2017+ |
| **Kraken**   | ✅   | ✅      | ❌      | ✅        | Strong fiat pairs, reliable                         |
| **KuCoin**   | ✅   | ✅      | ✅      | ✅        | Good altcoin coverage                               |
| **Bybit**    | ✅   | ✅      | ✅      | ✅        | Growing liquidity, good testnet                     |
| **Coinbase** | ✅   | ❌      | ❌      | ✅        | Major pairs only, regulatory compliance             |

---

## 9. Security Considerations

- **API keys** encrypted at rest with AES-256-GCM; master key from environment variable.
- **Never log** API keys or secrets — Pino redaction patterns configured.
- **Exchange API key permissions**: recommend read-only + trade-only (no withdrawal).
- **IP whitelisting** enabled on exchanges where supported.
- **No withdrawal capability** built into the platform.
- **.env files** in `.gitignore`; `.env.example` committed with placeholders.

---

## 10. Development Workflow

```bash
# First time setup
git clone <repo>
cp .env.example .env.local
pnpm install
docker compose up -d          # Postgres + Redis

# Database setup
pnpm --filter @tb/db migrate  # Run Drizzle migrations

# Development (all services)
pnpm dev                      # Turborepo runs all apps/packages in parallel

# Testing
pnpm test                     # All tests across monorepo
pnpm test --filter @tb/trading-core  # Single package

# Linting
pnpm lint
pnpm format
```

---

## 11. Future Deployment Targets

When ready to deploy, the recommended path:

1. **VPS (Hetzner/DigitalOcean)** — cheapest for always-on bots ($5-20/mo).
2. **Docker Compose** on VPS — same setup as local dev.
3. **Managed Postgres** (Supabase free tier or Railway) if you don't want to manage DB.
4. **GitHub Actions** for CI/CD — build Docker images, run tests, deploy on push to main.

---

## 12. Agent Execution Order

The agents must be run **sequentially** in the following order. Each phase depends on the output of the previous phase.

| Phase  | Document                                                           | Agent Role             | What It Produces                                                                                             | Depends On                   |
| ------ | ------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| **1**  | [03-INFRASTRUCTURE.md](./03-INFRASTRUCTURE.md)                     | Infrastructure/DevOps  | Monorepo skeleton, all configs, Docker Compose, stub packages, CI/CD                                         | Nothing (first)              |
| **2**  | [05-DATA-PIPELINE.md](./05-DATA-PIPELINE.md)                       | Data Engineer          | `@tb/db` schemas + migrations, `@tb/data-pipeline` collection/export logic, BullMQ job definitions           | Phase 1                      |
| **3**  | [04-TRADING-ENGINE.md](./04-TRADING-ENGINE.md)                     | Quantitative Developer | `@tb/indicators`, `@tb/trading-core` (exchange abstraction, backtesting engine, strategies, risk management) | Phases 1–2                   |
| **4**  | [02-BACKEND.md](./02-BACKEND.md)                                   | Backend Developer      | Fastify API server, tRPC routers, Socket.IO hub, BullMQ workers, security services                           | Phases 1–3                   |
| **5a** | [01a-FRONTEND-WIREFRAMES.md](./01a-FRONTEND-WIREFRAMES.md)         | UI/UX Designer         | 5 themed UI wireframes (static HTML/CSS) + Playwright screenshots for theme selection                        | Phases 1–4                   |
| **5b** | [01b-FRONTEND-IMPLEMENTATION.md](./01b-FRONTEND-IMPLEMENTATION.md) | Frontend Developer     | Next.js dashboard, all pages, charts, real-time data, full UI using chosen theme                             | Phase 5a + user theme choice |

### Why This Order?

1. **Infrastructure first** — every package needs the monorepo structure, TypeScript configs, ESLint, Docker, and Vitest to exist before any code can be written.
2. **Data pipeline second** — the `@tb/db` package defines all database schemas (OHLCV, bots, backtests, etc.) that both the trading engine and backend need. The data pipeline also populates the database with market data required for backtesting.
3. **Trading engine third** — the `@tb/trading-core` and `@tb/indicators` packages are pure logic packages with no app dependencies. They need `@tb/types` (from phase 1) and read historical data from `@tb/db` (from phase 2).
4. **Backend fourth** — the API server wires together `@tb/db`, `@tb/trading-core`, and `@tb/data-pipeline` into tRPC routes and BullMQ workers. It depends on all three packages being complete.
5. **Frontend last** — split into two sub-phases:
   - **5a: Wireframes** — a UI/UX agent creates 5 themed wireframes as static HTML/CSS pages and screenshots them with Playwright. The user reviews and picks a theme.
   - **5b: Implementation** — the frontend developer agent builds the full Next.js dashboard using the chosen theme. It consumes the backend's tRPC API and Socket.IO events, needing the full API contract for end-to-end type safety.

### Notes

- Each agent receives its plan document **plus** `00-ARCHITECTURE.md` as context.
- Each plan document contains both an **Agent System Prompt** (persona/expertise) and a **Task Prompt** (specific work instructions).
- Agents should run `pnpm lint`, `pnpm type-check`, and `pnpm test` after completing their work to verify nothing is broken.
- If an agent needs to modify a file created by a previous agent (e.g., adding fields to a `@tb/types` interface), it should do so — the types package is shared and expected to evolve.

---

## 13. Document Index

| Document                                                           | Agent Role             | Scope                                                               |
| ------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------- |
| [01a-FRONTEND-WIREFRAMES.md](./01a-FRONTEND-WIREFRAMES.md)         | UI/UX Designer         | 5 themed UI wireframes + screenshot catalog for theme selection     |
| [01b-FRONTEND-IMPLEMENTATION.md](./01b-FRONTEND-IMPLEMENTATION.md) | Frontend Developer     | Dashboard UI, charting, real-time data display (using chosen theme) |
| [02-BACKEND.md](./02-BACKEND.md)                                   | Backend Developer      | API server, tRPC routes, WebSocket hub, auth                        |
| [03-INFRASTRUCTURE.md](./03-INFRASTRUCTURE.md)                     | Infrastructure/DevOps  | Turborepo setup, Docker, CI/CD, env config                          |
| [04-TRADING-ENGINE.md](./04-TRADING-ENGINE.md)                     | Quantitative Developer | Backtesting engine, strategies, order management                    |
| [05-DATA-PIPELINE.md](./05-DATA-PIPELINE.md)                       | Data Engineer          | Market data collection, storage, export                             |
