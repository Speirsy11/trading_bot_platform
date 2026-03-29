# Backend API Server — Development Plan

## Agent System Prompt

```
You are a senior backend developer specialising in TypeScript, Node.js, and high-performance
API servers. You have deep experience with Fastify, PostgreSQL, Redis, real-time WebSocket
systems, and building reliable financial services. You follow test-driven development,
writing failing tests before implementation. You design clean, well-typed APIs with proper
error handling, validation, and security. You work within a Turborepo monorepo and expose
a tRPC API consumed by a Next.js frontend. You understand the importance of not losing data
or money in trading systems.
```

---

## Task Prompt

```
Your task is to build the API server and worker processes for the crypto trading bot
platform. This is Phase 4 — the monorepo scaffolding (03-INFRASTRUCTURE.md), the database
and data pipeline (05-DATA-PIPELINE.md), and the trading engine (04-TRADING-ENGINE.md)
have all been completed. You have working @tb/db, @tb/data-pipeline, @tb/trading-core,
and @tb/indicators packages ready to consume.

Specifically, you must:

1. Build the Fastify API server (apps/api) following the project structure in Section 3:
   - app.ts: Fastify app factory with all plugins registered (CORS, rate limit, health
     check, Socket.IO, tRPC, static file serving for exports).
   - index.ts: entrypoint that creates the app and starts listening on the configured port.
   - Proper Pino logging with redaction of sensitive fields.

2. Implement ALL 6 tRPC routers (Section 4) with full Zod input validation:
   - portfolio: getSummary, getPositions, getEquityCurve, getAllocation
   - bots: list, getById, create, update, start, pause, stop, delete, getMetrics, getTrades, getLogs
   - backtest: run, getStatus, getResults, list, delete
   - market: getTicker, getCandles, getSymbols, getDataCoverage, getStrategies
   - exchanges: list, add, testConnection, remove, update
   - dataExport: create, getStatus, list, delete
   All procedures must query @tb/db via Drizzle and return properly typed responses.

3. Build the WebSocket hub (Section 5):
   - Socket.IO setup with the namespace/room design specified.
   - Redis pub/sub subscription: listen for events published by workers and fan them out
     to connected dashboard clients based on room subscriptions.
   - Handle client subscribe/unsubscribe events for tickers, candles, bots, portfolio.

4. Set up BullMQ queue definitions and job dispatch (Section 6):
   - Create all 5 queues (bot-execution, backtest, data-collection, data-backfill, data-export).
   - Wire tRPC mutations to dispatch jobs to the correct queues.
   - Optionally expose Bull Board UI at /admin/queues for development.

5. Build the worker process (Section 13):
   - Separate entrypoint (workers/index.ts) that runs independently from the API server.
   - botExecutor worker: uses @tb/trading-core Bot and BotRunner to execute live/paper bots.
   - backtestRunner worker: uses @tb/trading-core BacktestEngine to run backtests.
   - dataCollector worker: uses @tb/data-pipeline DataCollector for scheduled collection.
   - dataExporter worker: uses @tb/data-pipeline ExportManager for export generation.
   - All workers publish events to Redis pub/sub for the WebSocket hub to forward.

6. Implement security services:
   - KeyVault (Section 7): AES-256-GCM encryption/decryption for exchange API keys.
     Generate random IV per encryption, store as base64(iv + authTag + ciphertext).
   - ExchangeManager (Section 8): lazy CCXT instance creation, caching, testnet support.
   - NEVER log decrypted keys. Use Pino redaction patterns.

7. Implement error handling (Section 11):
   - Map CCXT exchange errors to typed AppErrorCode values.
   - Return structured TRPCError responses.
   - Workers publish error events to Redis for dashboard notifications.

8. Write comprehensive tests (Section 12):
   - Unit tests for each tRPC router (mock DB and Redis).
   - Unit tests for KeyVault encryption/decryption roundtrip.
   - Integration tests with Testcontainers (real Postgres + Redis): full tRPC procedure
     execution, WebSocket event flow, BullMQ job roundtrip.
   - API tests with Supertest for HTTP-level concerns (status codes, CORS, rate limiting).

Follow TDD: write failing tests first, then implement. The API server must remain thin —
it dispatches work to BullMQ workers rather than doing heavy processing itself.

Refer to 00-ARCHITECTURE.md for shared types, 05-DATA-PIPELINE.md for DB schemas, and
04-TRADING-ENGINE.md for trading-core interfaces. Do NOT build the frontend dashboard.
```

---

## 1. Overview

Build the **API server** (`apps/api`) — a Fastify application that serves as the central hub for:

- **tRPC API** for the dashboard (type-safe request/response)
- **WebSocket hub** (Socket.IO) for real-time data streaming to the dashboard
- **BullMQ job orchestration** for background tasks (bot execution, data pipeline, exports)
- **Exchange API key management** with encryption at rest
- **Bot lifecycle management** (create, start, stop, pause, monitor)
- **Data export** generation and serving

The API server does NOT directly run trading bots or data collection — it dispatches those as BullMQ jobs to worker processes. This keeps the API responsive.

---

## 2. Technology Stack

| Concern | Library | Notes |
|---|---|---|
| Framework | **Fastify** `^5.x` | Fastest Node.js framework; native async/await; plugin architecture |
| Type-safe API | **tRPC** `^11.x` | End-to-end type safety with the Next.js frontend |
| WebSocket | **Socket.IO** via `@fastify/socket.io` | Real-time event streaming to dashboard |
| Validation | **Zod** | Input validation for all tRPC procedures |
| Database | **Drizzle ORM** (from `@tb/db` package) | Type-safe queries, minimal runtime overhead |
| Job Queue | **BullMQ** | Dispatch background jobs to workers |
| Caching | **ioredis** | Direct Redis access for caching and pub/sub |
| Logging | **Pino** (built into Fastify) | Structured JSON logging with redaction |
| Auth (API keys) | **crypto** (Node.js built-in) | AES-256-GCM encryption for exchange keys |
| Testing | **Vitest** + **Supertest** | Unit tests, API integration tests |
| Process | **tsx** (dev) / **Node.js** (prod) | TypeScript execution |

---

## 3. Project Structure

```
apps/api/
├── src/
│   ├── index.ts                    # Entrypoint: create Fastify app, register plugins, start
│   ├── app.ts                      # Fastify app factory (for testing)
│   │
│   ├── trpc/
│   │   ├── context.ts              # tRPC context (db, redis, queues)
│   │   ├── router.ts               # Root tRPC router (merges all sub-routers)
│   │   ├── trpc.ts                 # tRPC instance creation
│   │   └── routers/
│   │       ├── portfolio.ts        # Portfolio queries & mutations
│   │       ├── bots.ts             # Bot CRUD, lifecycle control
│   │       ├── backtest.ts         # Backtest configuration & results
│   │       ├── market.ts           # Market data queries, tickers
│   │       ├── trades.ts           # Trade history queries
│   │       ├── exchanges.ts        # Exchange configuration management
│   │       ├── dataExport.ts       # Data export job dispatch
│   │       └── settings.ts         # App settings
│   │
│   ├── websocket/
│   │   ├── index.ts                # Socket.IO setup and namespace registration
│   │   ├── handlers/
│   │   │   ├── market.ts           # Price ticker / candle subscriptions
│   │   │   ├── bots.ts             # Bot status event forwarding
│   │   │   └── portfolio.ts        # Portfolio real-time updates
│   │   └── middleware/
│   │       └── auth.ts             # WebSocket connection auth (if needed later)
│   │
│   ├── workers/
│   │   ├── index.ts                # Worker process entrypoint (separate from API)
│   │   ├── botExecutor.ts          # BullMQ worker: run live/paper trading bots
│   │   ├── backtestRunner.ts       # BullMQ worker: execute backtests
│   │   ├── dataCollector.ts        # BullMQ worker: fetch market data
│   │   └── dataExporter.ts         # BullMQ worker: generate export files
│   │
│   ├── queues/
│   │   ├── connection.ts           # Shared Redis/BullMQ connection
│   │   ├── botQueue.ts             # Bot execution queue definition
│   │   ├── backtestQueue.ts        # Backtest queue definition
│   │   ├── dataQueue.ts            # Data collection queue definition
│   │   └── exportQueue.ts          # Data export queue definition
│   │
│   ├── services/
│   │   ├── exchangeManager.ts      # CCXT exchange instance management
│   │   ├── keyVault.ts             # API key encryption/decryption
│   │   ├── botManager.ts           # Bot state machine coordination
│   │   └── metricsCalculator.ts    # Aggregate portfolio/bot metrics
│   │
│   ├── plugins/
│   │   ├── cors.ts                 # CORS configuration
│   │   ├── rateLimit.ts            # API rate limiting
│   │   └── health.ts               # Health check endpoint
│   │
│   └── utils/
│       ├── errors.ts               # Custom error classes
│       └── logger.ts               # Pino logger configuration with redaction
│
├── test/
│   ├── setup.ts                    # Test setup (testcontainers, mocks)
│   ├── fixtures/                   # Test data fixtures
│   └── helpers/                    # Test utility functions
│
├── nodemon.json
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. tRPC Router Design

All input validated with Zod. All procedures are type-safe end-to-end with the frontend.

### 4.1 Portfolio Router

```typescript
// trpc/routers/portfolio.ts
portfolio.router({
  // Get portfolio summary (total value, PnL, allocation)
  getSummary: publicProcedure.query(),

  // Get all positions across exchanges
  getPositions: publicProcedure.query(),

  // Get portfolio equity curve over time
  getEquityCurve: publicProcedure
    .input(z.object({ period: z.enum(["1d", "1w", "1m", "3m", "1y", "all"]) }))
    .query(),

  // Get portfolio allocation breakdown
  getAllocation: publicProcedure.query(),
})
```

### 4.2 Bots Router

```typescript
// trpc/routers/bots.ts
bots.router({
  // List all bots with status
  list: publicProcedure
    .input(z.object({
      status: z.enum(["all", "running", "paused", "stopped"]).optional(),
      exchange: z.string().optional(),
    }))
    .query(),

  // Get single bot with full details
  getById: publicProcedure
    .input(z.object({ botId: z.string().uuid() }))
    .query(),

  // Create new bot
  create: publicProcedure
    .input(botConfigSchema)   // Zod schema from @tb/types
    .mutation(),

  // Update bot configuration (only when stopped)
  update: publicProcedure
    .input(z.object({ botId: z.string().uuid(), config: botConfigSchema.partial() }))
    .mutation(),

  // Start bot (dispatches BullMQ job)
  start: publicProcedure
    .input(z.object({ botId: z.string().uuid() }))
    .mutation(),

  // Pause bot
  pause: publicProcedure
    .input(z.object({ botId: z.string().uuid() }))
    .mutation(),

  // Stop bot (graceful shutdown)
  stop: publicProcedure
    .input(z.object({ botId: z.string().uuid() }))
    .mutation(),

  // Delete bot (only when stopped)
  delete: publicProcedure
    .input(z.object({ botId: z.string().uuid() }))
    .mutation(),

  // Get bot performance metrics
  getMetrics: publicProcedure
    .input(z.object({ botId: z.string().uuid() }))
    .query(),

  // Get bot trade history
  getTrades: publicProcedure
    .input(z.object({
      botId: z.string().uuid(),
      limit: z.number().min(1).max(500).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(),

  // Get bot logs
  getLogs: publicProcedure
    .input(z.object({
      botId: z.string().uuid(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(),
})
```

### 4.3 Backtest Router

```typescript
// trpc/routers/backtest.ts
backtest.router({
  // Run a new backtest (dispatches BullMQ job)
  run: publicProcedure
    .input(backtestConfigSchema)
    .mutation(),  // Returns { backtestId }

  // Get backtest status/progress
  getStatus: publicProcedure
    .input(z.object({ backtestId: z.string().uuid() }))
    .query(),   // Returns { status, progress, currentDate }

  // Get backtest results
  getResults: publicProcedure
    .input(z.object({ backtestId: z.string().uuid() }))
    .query(),   // Returns full BacktestResults

  // List past backtests
  list: publicProcedure
    .input(z.object({
      strategy: z.string().optional(),
      symbol: z.string().optional(),
      limit: z.number().default(20),
    }))
    .query(),

  // Delete a backtest result
  delete: publicProcedure
    .input(z.object({ backtestId: z.string().uuid() }))
    .mutation(),
})
```

### 4.4 Market Router

```typescript
// trpc/routers/market.ts
market.router({
  // Get current ticker for a symbol
  getTicker: publicProcedure
    .input(z.object({ exchange: z.string(), symbol: z.string() }))
    .query(),

  // Get OHLCV candles from local database
  getCandles: publicProcedure
    .input(z.object({
      exchange: z.string(),
      symbol: z.string(),
      timeframe: z.string(),
      startTime: z.number().optional(),
      endTime: z.number().optional(),
      limit: z.number().max(5000).default(500),
    }))
    .query(),

  // List available trading pairs for an exchange
  getSymbols: publicProcedure
    .input(z.object({ exchange: z.string() }))
    .query(),

  // Get data coverage info (what data we have locally)
  getDataCoverage: publicProcedure
    .input(z.object({
      exchange: z.string(),
      symbol: z.string(),
      timeframe: z.string(),
    }))
    .query(),   // Returns { earliest, latest, gapCount, completeness% }

  // Get available strategies and their parameter schemas
  getStrategies: publicProcedure.query(),
})
```

### 4.5 Exchanges Router

```typescript
// trpc/routers/exchanges.ts
exchanges.router({
  // List configured exchanges
  list: publicProcedure.query(),

  // Add exchange API keys
  add: publicProcedure
    .input(z.object({
      exchange: z.string(),
      name: z.string(),       // User-friendly label
      apiKey: z.string(),
      apiSecret: z.string(),
      passphrase: z.string().optional(),  // Some exchanges require this
      testnet: z.boolean().default(false),
    }))
    .mutation(),

  // Test exchange connection (validates API keys)
  testConnection: publicProcedure
    .input(z.object({ exchangeId: z.string().uuid() }))
    .mutation(),  // Returns { success, permissions, balance }

  // Remove exchange configuration
  remove: publicProcedure
    .input(z.object({ exchangeId: z.string().uuid() }))
    .mutation(),

  // Update exchange config (e.g., label)
  update: publicProcedure
    .input(z.object({ exchangeId: z.string().uuid(), name: z.string().optional() }))
    .mutation(),
})
```

### 4.6 Data Export Router

```typescript
// trpc/routers/dataExport.ts
dataExport.router({
  // Start an export job
  create: publicProcedure
    .input(z.object({
      exchange: z.string(),
      symbols: z.array(z.string()).min(1),
      timeframe: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      format: z.enum(["csv", "parquet", "sqlite"]),
      compress: z.boolean().default(true),
    }))
    .mutation(),  // Returns { exportId }

  // Get export job status
  getStatus: publicProcedure
    .input(z.object({ exportId: z.string().uuid() }))
    .query(),   // Returns { status, progress, downloadUrl? }

  // List past exports
  list: publicProcedure.query(),

  // Delete an export file
  delete: publicProcedure
    .input(z.object({ exportId: z.string().uuid() }))
    .mutation(),
})
```

---

## 5. WebSocket Hub (Socket.IO)

The API server acts as a **fan-out hub** — it receives events from Redis pub/sub (published by workers) and forwards them to connected dashboard clients.

### Architecture

```
Workers (bot, data pipeline)
  → Publish events to Redis pub/sub channels
    → API Server subscribes to Redis channels
      → Socket.IO emits to connected dashboard clients (filtered by room/subscription)
```

### Namespace & Room Design

```
io.of("/")                      # Default namespace
  room: "ticker:{exchange}:{symbol}"     # Price subscribers
  room: "candle:{exchange}:{symbol}:{tf}" # Candle subscribers  
  room: "bot:{botId}"                    # Bot-specific events
  room: "portfolio"                      # Portfolio updates
  room: "backtest:{backtestId}"          # Backtest progress
```

### Events Emitted by Workers → Redis → Socket.IO

| Redis Channel | Socket.IO Event | Payload |
|---|---|---|
| `market:ticker` | `price:ticker` | `{ exchange, symbol, bid, ask, last, volume, change24h }` |
| `market:candle` | `price:candle` | `{ exchange, symbol, timeframe, candle }` |
| `bot:status` | `bot:statusChange` | `{ botId, status, timestamp }` |
| `bot:trade` | `bot:trade` | `{ botId, trade }` |
| `bot:metrics` | `bot:metrics` | `{ botId, metrics }` |
| `portfolio:update` | `portfolio:update` | `{ totalValue, change24h, positions }` |
| `backtest:progress` | `backtest:progress` | `{ backtestId, progress, currentDate }` |
| `data:status` | `data:collectionStatus` | `{ exchange, symbol, status, lastUpdated }` |

---

## 6. BullMQ Integration

The API server creates and manages BullMQ **queues** and dispatches jobs. Separate **worker processes** consume the jobs.

### Queues

| Queue Name | Purpose | Concurrency | Notes |
|---|---|---|---|
| `bot-execution` | Start/stop/manage trading bots | 10 | Long-running; one job per active bot |
| `backtest` | Run backtests | 2 | CPU-intensive; limit concurrency |
| `data-collection` | OHLCV fetch jobs | 5 | Rate-limited per exchange |
| `data-backfill` | Historical data download | 2 | Low priority, background |
| `data-export` | Generate export files | 1 | I/O bound |

### Job Dispatch Pattern

```typescript
// In tRPC mutation handler
async startBot(botId: string) {
  // 1. Validate bot exists and is in a startable state
  const bot = await db.query.bots.findFirst({ where: eq(bots.id, botId) });
  if (!bot) throw new TRPCError({ code: "NOT_FOUND" });
  if (bot.status === "running") throw new TRPCError({ code: "CONFLICT" });

  // 2. Update bot status in DB
  await db.update(bots).set({ status: "starting" }).where(eq(bots.id, botId));

  // 3. Dispatch BullMQ job
  await botQueue.add("start-bot", { botId }, {
    jobId: `bot-${botId}`,  // Deduplicate: one job per bot
    removeOnComplete: false, // Keep for status queries
    removeOnFail: false,
  });

  // 4. Publish status change via Redis (→ Socket.IO → Dashboard)
  await redis.publish("bot:status", JSON.stringify({
    botId, status: "starting", timestamp: Date.now(),
  }));

  return { success: true };
}
```

---

## 7. API Key Security (KeyVault Service)

```typescript
// services/keyVault.ts — design outline
//
// Encrypt API keys before storing in database.
// Decrypt only when creating CCXT exchange instances.
// Master encryption key comes from environment variable (ENCRYPTION_KEY).
//
// Algorithm: AES-256-GCM (authenticated encryption)
// - Generates random 16-byte IV per encryption
// - Produces auth tag for tamper detection
// - Stores as: base64(iv + authTag + ciphertext)
//
// IMPORTANT:
// - Never log decrypted keys
// - Never return decrypted keys via API
// - Decrypted keys are held in memory only as long as needed
// - Pino logger has redaction paths configured for "apiKey", "apiSecret", "secret"
```

---

## 8. Exchange Manager Service

Manages CCXT exchange instances, caching them to avoid repeated instantiation:

```typescript
// services/exchangeManager.ts — design outline
//
// - Lazily creates CCXT exchange instances on first use
// - Caches instances (one per exchange config)
// - Handles testnet vs production configuration
// - Provides a unified interface for all exchange operations
// - Wraps CCXT errors into typed application errors
//
// Key methods:
//   getExchange(exchangeConfigId: string): Promise<ccxt.Exchange>
//   testConnection(exchangeConfigId: string): Promise<ConnectionTestResult>
//   getAvailableSymbols(exchange: string): Promise<string[]>
```

---

## 9. Database Interaction

The API uses the shared `@tb/db` package (Drizzle ORM) for all database operations.

### Key Tables (defined in `@tb/db`)

| Table | Purpose |
|---|---|
| `exchange_configs` | Stored exchange API keys (encrypted) |
| `bots` | Bot configurations and current status |
| `bot_trades` | All trades executed by bots |
| `bot_logs` | Bot event logs |
| `backtests` | Backtest configurations and results |
| `backtest_trades` | Simulated trades from backtests |
| `ohlcv` | Historical OHLCV data (TimescaleDB hypertable) |
| `data_exports` | Export job records and file paths |
| `settings` | App settings key-value store |

---

## 10. Health & Monitoring

### Health Check Endpoint

```
GET /health → 200 { status: "ok", uptime, db: "connected", redis: "connected" }
```

Checks:
- Database connection (simple query)
- Redis connection (PING)
- BullMQ queue status

### Logging

- **Pino** (built into Fastify) for structured JSON logs.
- Redaction patterns for sensitive fields: `apiKey`, `apiSecret`, `secret`, `password`.
- Log levels: `debug` in dev, `info` in production.
- Request/response logging via Fastify's built-in logger.

### BullMQ Dashboard

- Optionally expose **Bull Board** UI at `/admin/queues` for monitoring job queues during development.
- This should be protected or disabled in production.

---

## 11. Error Handling

- All tRPC procedures use structured error types via `TRPCError`.
- Exchange errors (from CCXT) are caught and mapped to application-level errors.
- Workers publish error events to Redis → dashboard shows notifications.
- Rate limit errors from exchanges trigger exponential backoff in workers.
- Database errors are logged and returned as `INTERNAL_SERVER_ERROR`.

### Error Categories

```typescript
// utils/errors.ts
enum AppErrorCode {
  EXCHANGE_CONNECTION_FAILED = "EXCHANGE_CONNECTION_FAILED",
  EXCHANGE_RATE_LIMITED = "EXCHANGE_RATE_LIMITED",
  EXCHANGE_INSUFFICIENT_FUNDS = "EXCHANGE_INSUFFICIENT_FUNDS",
  BOT_ALREADY_RUNNING = "BOT_ALREADY_RUNNING",
  BOT_NOT_FOUND = "BOT_NOT_FOUND",
  INVALID_STRATEGY = "INVALID_STRATEGY",
  BACKTEST_DATA_UNAVAILABLE = "BACKTEST_DATA_UNAVAILABLE",
  ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
}
```

---

## 12. Testing Strategy

### Unit Tests

- Test each tRPC router procedure in isolation (mock DB and Redis).
- Test KeyVault encryption/decryption with known test vectors.
- Test exchange manager error mapping.
- Test BullMQ job dispatch logic (mock queue).

### Integration Tests

- Use **Testcontainers** to spin up PostgreSQL + Redis in Docker.
- Test full tRPC procedure execution against real database.
- Test WebSocket event flow: trigger → Redis pub/sub → Socket.IO emit.
- Test BullMQ job roundtrip: enqueue → worker processes → result stored.

### API Tests (Supertest)

- Test the Fastify HTTP layer:
  - tRPC endpoints return correct status codes
  - Health check endpoint
  - CORS headers
  - Rate limiting

### Test Setup

```typescript
// test/setup.ts
// - Start Postgres + Redis containers via Testcontainers
// - Run migrations
// - Create test fixtures
// - Export db/redis connections for tests
// - Teardown after all tests
```

---

## 13. Worker Process

Workers run as a **separate Node.js process** from the API server. This keeps the API responsive even under heavy backtesting or data collection load.

```bash
# Development: two processes
pnpm --filter api dev:server   # Fastify API
pnpm --filter api dev:workers  # BullMQ workers
```

Workers re-use the same `@tb/db`, `@tb/trading-core`, `@tb/data-pipeline`, and `@tb/indicators` packages. They communicate with the API server only through Redis (pub/sub for events, BullMQ for jobs).

---

## 14. Dependencies to Install

```bash
# Framework
fastify @fastify/cors @fastify/rate-limit @fastify/static @fastify/websocket

# tRPC
@trpc/server zod

# Socket.IO
socket.io @fastify/socket.io

# Database
drizzle-orm postgres  # (from @tb/db)

# Redis & Queues
ioredis bullmq
@bull-board/api @bull-board/fastify  # Queue monitoring UI

# Exchange
ccxt

# Security
# (uses Node.js built-in crypto module)

# Logging
pino pino-pretty  # pino is built into Fastify; pino-pretty for dev

# Process
tsx nodemon tsup

# Testing
vitest supertest @testcontainers/postgresql
```
