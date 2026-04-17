# Current State & Production-Quality Roadmap

_Generated: 2026-04-12 — assessment of the trading-bot-platform against planning documents in `docs/plans/`._

## 1. Executive Summary

The platform is **~70% implemented against the original plan**. The monorepo, database schemas, core trading engine, data collection pipeline, and most frontend pages are in place and functional. The remaining ~30% is a mix of (a) wiring gaps that stop specific UI flows from working end-to-end, (b) production-hardening work (auth, observability, hosting, safeguards for live trading), and (c) polish that separates a demo from a product.

**Where we are:**

- Backtesting, paper trading, and market-data browsing all work locally against seeded data.
- Dashboard, bot list, bot wizard, backtest runner, history, and settings pages are connected to real tRPC routes.
- Data ingestion runs on BullMQ repeatable jobs against Binance, writing to TimescaleDB hypertables.

**Where we need to go:**

- Close the remaining stubs so every UI flow works end-to-end.
- Add a thin auth layer and operational safeguards so the platform can run unattended.
- Move data ingestion to always-on hosting with monitoring and alerting.
- Polish the UX pass: multi-theme support, empty/error/loading states, mobile layout, accessibility.

## 2. State of Play by Area

| Area                  | Status        | Score | What's there                                         | What's missing                                                                             |
| --------------------- | ------------- | ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Monorepo scaffolding  | ✅ Done       | 9/10  | Turbo, pnpm, Docker, CI                              | Prod docker-compose still identical to dev                                                 |
| Database schemas      | ✅ Done       | 8/10  | Drizzle models, TimescaleDB hypertable, migrations   | No FKs, no soft deletes, no retention policy                                               |
| Market data ingestion | ⚠️ Partial    | 7/10  | REST CCXT collection, dedupe, gap detection          | WebSocket streaming not wired; single exchange seeded                                      |
| Backtest engine       | ✅ Done       | 8/10  | Event loop, metrics, 2 strategies                    | Only 2 strategies; no walk-forward; no reference vs. Python `ta`                           |
| Bot runtime (paper)   | ✅ Done       | 7/10  | Bot/BotRunner/RiskManager/PositionSizer              | Limited integration tests; no chaos testing                                                |
| Bot runtime (live)    | ❌ Risky      | 3/10  | `LiveExchange` wraps CCXT                            | No 2-phase confirm, no position caps, no kill-switch, no sandbox tested                    |
| API (tRPC)            | ✅ Done       | 7/10  | 7 routers, Zod validation, error mapping             | No `/health`, no OpenAPI, one global token                                                 |
| Socket.IO hub         | ⚠️ Partial    | 6/10  | Publishes data:status / bot logs / backtest progress | No presence, no per-user rooms, no auth on socket                                          |
| Frontend pages        | ⚠️ Partial    | 7/10  | 14 pages, tRPC + WS hooks, charts                    | Trading form stub, dashboard RecentTrades stub, bot detail charts empty, no theme selector |
| Auth & security       | ❌ Basic      | 3/10  | Single shared bearer, encrypted exchange keys        | No users, no sessions, CORS `origin:true`, no rate-limit per user                          |
| Observability         | ❌ None       | 1/10  | Pino to stdout                                       | No error tracking, no metrics, no dashboards, no alerts                                    |
| Deployment            | ❌ Local only | 3/10  | Dockerfiles build                                    | No hosting, no backups, no IaC, no domain                                                  |
| Tests                 | ⚠️ Partial    | 6/10  | ~35 files, unit + some integration                   | No E2E Playwright flows, no live-trading sandbox tests                                     |

## 3. Critical Fixes (Blocks Basic Functionality)

These should land before anything else — each is a small, concrete wiring fix.

1. **`/health` endpoint missing.** Dockerfile references it but Fastify has no route. [`apps/api/src/app.ts`](apps/api/src/app.ts)
2. **Dashboard `RecentTrades` is a hardcoded empty array.** Needs to subscribe to `bots.getTrades` with `limit: 10`. [`apps/web/src/components/dashboard/RecentTrades.tsx`](apps/web/src/components/dashboard/RecentTrades.tsx)
3. **`/trading` order form is a stub.** The submit button has no mutation — needs wiring to a new `trading.placeOrder` tRPC procedure that routes through `ExchangeManager`. [`apps/web/src/app/trading/page.tsx`](apps/web/src/app/trading/page.tsx)
4. **`/trading` order book is mock data.** Needs `market.getOrderBook` + live updates via Socket.IO. [`apps/web/src/app/trading/page.tsx`](apps/web/src/app/trading/page.tsx)
5. **Bot detail charts show empty arrays.** Equity curve and candlestick data not plumbed through from `bots.getMetrics` / `market.getCandles`. [`apps/web/src/app/bots/[botId]/page.tsx`](apps/web/src/app/bots/[botId]/page.tsx)
6. **Parquet export dependency missing.** Selecting Parquet in export modal crashes the worker. Either install `parquetjs-lite` or remove the option until implemented. [`packages/data-pipeline/src/export/`](packages/data-pipeline/src/export/)

## 4. Coding Tasks (Agent-Executable)

### Orchestrator Prompt

Paste the block below as the prompt for an orchestrator agent. The orchestrator's job is to pull tasks from §4 and dispatch them to subagents in parallel, verify results, and report back. Do not paste the section headings as tasks — the orchestrator should treat each `CF-*`, `FE-*`, `BE-*`, `LT-*`, `DP-*`, `OP-*`, `T-*`, `API-*` as a discrete work item.

```text
You are the orchestrator for the trading-bot-platform production-readiness roadmap. Your job is
NOT to write code yourself — it is to dispatch subagents, track their progress, verify their
output, and keep feeding them new tasks until the queue is drained.

Source of truth: docs/plans/CURRENT_STATE_AND_ROADMAP.md, section 4. Each item is tagged
(CF-1, FE-3, BE-7, etc.) and each tag is one work unit.

Priorities (tackle in this order):
  1. §4.1 Wiring Fixes (CF-*)            — unblocks everything else
  2. §4.4 Live-Trading Safeguards (LT-*) — safety critical
  3. §4.3 Backend Completion (BE-*)
  4. §4.2 Frontend Completion (FE-*)
  5. §4.5 Data Pipeline Hardening (DP-*)
  6. §4.6 Observability (OP-*)
  7. §4.7 Testing (T-*)
  8. §4.8 API & DX (API-*)

How to run the loop:

1. Maintain a TodoWrite list mirroring §4 with status (pending/in_progress/done/blocked).
2. Pick the next 2–3 highest-priority tasks that are (a) not blocked, (b) have no unresolved
   dependency on an in-flight task, and (c) touch disjoint files so they can run in parallel.
3. Dispatch each task as its own subagent using the Agent tool with subagent_type="general-purpose".
   Launch multiple agents in a SINGLE message when they're independent.
4. For each subagent, the prompt MUST include:
     - The task id and the full text of the task from §4
     - The relevant file paths (see §3 for hints, or have the subagent locate them)
     - "Write code, run tests, commit nothing — report back a diff summary and the list of
       files touched."
     - "If you discover the task is larger than expected, stop and report scope instead of
       expanding the work."
     - "If a dependency on another task becomes obvious, surface it in your report."
5. When a subagent returns:
     - Read its report
     - Spot-check the critical files it changed
     - Run: pnpm lint, pnpm type-check, and the targeted test suite for that area
     - If any of those fail, dispatch a follow-up subagent with the failure output to fix it
     - If everything passes, mark the todo done and move on
6. After every 3 completed tasks, run the full test suite (pnpm test) as a regression check.
7. Never dispatch more than 3 subagents concurrently. Serialize tasks that touch the same files.
8. Stop and ask the human before:
     - Any LT-* (live trading safeguard) goes from paper to real-money testing
     - Any task requires secrets (API keys, encryption keys, production credentials)
     - Any task requires an account the human must create (see §5 External Tasks)
     - A subagent reports the task can't be completed without an architecture decision
9. Every N tasks or 30 minutes, post a status summary: done / in-flight / blocked / next-up.

Do NOT:
  - Work on tasks from §5 — those are human-only.
  - Start live-trading tests without explicit human approval.
  - Skip the verification step after a subagent reports success.
  - Commit or push anything unless the human explicitly says so.

Begin by reading docs/plans/CURRENT_STATE_AND_ROADMAP.md §4 end-to-end, building the todo list,
then dispatching the first batch of CF-* tasks in parallel.
```

### Task List

Tasks grouped by theme. Each is scoped so a coding agent can pick it up without needing to plan.

### 4.1 Wiring Fixes (extends the Critical list)

- **CF-1** Add `GET /health` returning DB + Redis ping status.
- **CF-2** Wire `RecentTrades` component to `trpc.bots.getTrades.useQuery({ limit: 10 })`, add empty state, loading skeleton, and socket refresh on `bot:trade`.
- **CF-3** Build `market.getOrderBook` tRPC procedure (CCXT `fetchOrderBook`) + a socket channel `market:orderBook:{symbol}` that streams updates. Wire `/trading` order book.
- **CF-4** Build `trading.placeOrder` / `trading.cancelOrder` tRPC procedures hitting `LiveExchange` with risk checks. Wire the `/trading` order form including buy/sell/limit/market.
- **CF-5** Fix bot detail page: pass equity curve points from `bots.getMetrics`, pass candles from `market.getCandles`, add trade markers using lightweight-charts series markers.
- **CF-6** Install `parquetjs-lite`, implement `exportParquet` (streaming writer), add unit test.

### 4.2 Frontend Completion

- **FE-1** Add global `<Toaster />` (Sonner or shadcn toast) and replace inline error text with toasts for mutations.
- **FE-2** Add confirmation modal for destructive actions (stop bot, delete exchange key, close position). Reuse a single `<ConfirmDialog>` component.
- **FE-3** Add page-level loading skeletons (React Suspense boundaries) for every top-level page. Today only some cards animate-pulse.
- **FE-4** Add empty states with illustrations for: no bots, no trades, no market data yet, no backtests, no exchange keys.
- **FE-5** Add explicit error states for failed tRPC queries (not just ErrorBoundary) with retry buttons.
- **FE-6** Add a `NotFound` (`not-found.tsx`) and `error` (`error.tsx`) at each route level.
- **FE-7** Responsive layout pass: collapse sidebar to bottom nav on mobile, make tables horizontally scroll with sticky first column, stack forms.
- **FE-8** Accessibility pass: `aria-invalid` + `aria-describedby` on form errors, `aria-live="polite"` region for WebSocket updates, skip-to-content link, focus ring review, keyboard-reachable modals.
- **FE-9** Keyboard shortcuts: `⌘K` command palette (jump to any page + symbol search), `Esc` to close modals, `?` to show shortcut help.
- **FE-10** Tooltips on jargon (Sharpe ratio, drawdown, profit factor) explaining the metric.
- **FE-11** Portfolio pie chart built but not rendered anywhere — add to dashboard.
- **FE-12** Dashboard grid layout: save/load user layouts per device, add "Reset layout" button.
- **FE-13** Number formatting: add user preference for decimal places and base currency (USD/EUR/GBP/BTC).
- **FE-14** Timezone preference applied to every date in the UI (pull from Settings).
- **FE-15** Trade history filters: save filter presets, URL-sync filters so views are shareable.
- **FE-16** Bot wizard: "load template" button for common strategy setups; persist draft to localStorage so refresh doesn't lose state.
- **FE-17** Candlestick chart: indicator overlays (SMA/EMA/BBands/RSI) with on/off toggles, crosshair with OHLC tooltip.
- **FE-18** Real-time P&L ticker in header when any bot is running.
- **FE-19** Delete unused `ColourSchemeProvider` stub and simplify the provider tree to only what's in use.

### 4.3 Backend Completion

- **BE-1** Implement remaining tRPC procedures the UI expects but backend doesn't have: `trading.placeOrder`, `trading.cancelOrder`, `market.getOrderBook`, `bots.getLogs` (paginated), `backtest.compare` (overlay multiple).
- **BE-2** Socket.IO namespace/room design: one room per bot, one room per symbol, one room per user. Clients join only what they're looking at.
- **BE-3** Wire the real-time WebSocket streaming stubs (`WebSocketManager`, `StreamProcessor`, `ReconnectHandler`) into the data collector so live prices don't rely on 60s REST polling.
- **BE-4** Add structured logging context (bot id, backtest id, request id) to Pino; propagate request id through tRPC middleware.
- **BE-5** Implement proper worker retry + dead-letter handling with backoff; surface failed jobs on a `failures` tRPC endpoint.
- **BE-6** Add CCXT error → `AppErrorCode` mapping for all exchanges, with typed frontend handling.
- **BE-7** Add 1–2 more strategies (BollingerBounce, GridTrading, or DCA) per `04-TRADING-ENGINE.md`.
- **BE-8** Reference-test indicators against Python `ta` library values (golden fixtures).
- **BE-9** Backtest determinism: seed random, fixed fee/slippage models, `backtest.compare` procedure that returns overlaid equity curves.
- **BE-10** Bot lifecycle hardening: idempotent start/stop, recover in-flight orders after restart, handle exchange disconnect without crashing.
- **BE-11** Rate-limit tRPC per IP and per token (not just global 300/min).
- **BE-12** Lock down CORS to configured origins, not `origin: true`.
- **BE-13** Redis-backed session store if multi-user auth is added.
- **BE-14** Add Drizzle foreign keys (bot → exchangeConfig, trades → bot, backtestTrades → backtest) and `ON DELETE` semantics.
- **BE-15** Add soft deletes (`deletedAt`) for bots, backtests, exchange keys — audit trail preserved.
- **BE-16** Data retention job: purge `botLogs` older than N days, archive old `ohlcv` to cold storage or drop.

### 4.4 Live-Trading Safeguards

These are the difference between "it works on paper" and "it's safe to leave unattended".

- **LT-1** Explicit two-phase confirm modal to move a bot from paper → live. Must type the bot name to confirm.
- **LT-2** Hard position-size cap (env var `MAX_NOTIONAL_USD`) enforced server-side regardless of bot config.
- **LT-3** Per-bot daily loss limit that auto-pauses the bot and emits an alert.
- **LT-4** Global kill-switch endpoint (`POST /emergency-stop`) that pauses all live bots and cancels open orders.
- **LT-5** Catastrophic-failure detection: if observed balance drops > X% faster than strategy predicted, auto-pause and alert.
- **LT-6** Order reconciliation job: on startup, reconcile local order state vs. exchange to detect stuck orders.
- **LT-7** Sandbox integration tests: run the full bot loop against Binance testnet / Bybit testnet in CI.
- **LT-8** Audit log table recording every live order placed, with who/when/why.

### 4.5 Data Pipeline Hardening

- **DP-1** Implement WebSocket streaming integration (see BE-3 above).
- **DP-2** Multi-exchange seeding: add Kraken, KuCoin, Bybit, Coinbase to default config, not just Binance.
- **DP-3** Adaptive rate-limiting: back off when exchange returns 429, resume when clear.
- **DP-4** Backfill prioritisation queue: 30d → 90d → 1y → older, so recent data is usable first.
- **DP-5** Gap detection every 15min instead of 6h for real-time alerts.
- **DP-6** Parquet export using `parquetjs-lite`.
- **DP-7** Export compression (gzip/zstd) toggle in export worker.
- **DP-8** Export job streaming: use cursor pagination to avoid OOM on multi-year exports.
- **DP-9** Supplemental sources: CoinGecko metadata (market cap, rank, logo) enriches the symbols table.
- **DP-10** Data-quality dashboard: page showing per-symbol completeness, last gap, last successful collection, rows stored.
- **DP-11** Collector metrics: rows/sec, validation failures, CCXT errors — exposed via Prometheus.

### 4.6 Observability & Operations

- **OP-1** Sentry (free tier: 5k errors/mo) for the API, workers, and frontend.
- **OP-2** Prometheus metrics endpoint (`/metrics`) with counters for jobs, orders, WS connections, and histograms for request latency and bot tick duration.
- **OP-3** Health endpoint (see CF-1) returns 200 only if DB + Redis + at least one exchange API reachable.
- **OP-4** Alerts: at minimum Discord/Telegram webhook on bot error, failed job, exchange 5xx streak, or gap-detection regression.
- **OP-5** Structured logs shipped to Grafana Cloud Loki (free 50GB/mo) or Better Stack (free tier).
- **OP-6** Backup strategy: nightly `pg_dump` to S3-compatible storage (Cloudflare R2 free 10GB, Backblaze B2 cheap).
- **OP-7** Restore runbook doc + quarterly restore drill.
- **OP-8** Worker supervisor: if any BullMQ worker crashes, the container restarts and resumes the queue.
- **OP-9** Read-only "status page" (can be a single Next.js page) showing health, uptime, data freshness, last trades — bookmarkable.

### 4.7 Testing

- **T-1** Playwright E2E covering: create bot → run backtest → view results → start paper trading.
- **T-2** Playwright E2E for trading terminal place-order flow.
- **T-3** Integration test for data collector hitting Binance testnet, writing to a testcontainers Postgres.
- **T-4** Chaos tests: kill Redis mid-backtest, kill API mid-order, ensure recovery.
- **T-5** Load test: 100 concurrent socket clients, 10 backtests in parallel — measure tail latency.
- **T-6** Visual regression via Playwright screenshots for each theme + major page.

### 4.8 API & Developer Experience

- **API-1** OpenAPI/Swagger auto-generated from tRPC via `trpc-openapi` (useful even for internal tooling).
- **API-2** `/docs` page serving Swagger UI in dev mode.
- **API-3** Auto-generated TypeScript SDK published to local monorepo for scripts/notebooks.
- **API-4** Environment validation at startup prints a clean table of what's loaded / missing.
- **API-5** CLI tool (`tbp`) for running backfills, starting/stopping bots, and triggering exports without the UI.

## 5. External Tasks (User-Driven)

These need you (Charlie) to act — they can't be done by a coding agent.

### 5.1 Accounts & Credentials

- [ ] Create exchange accounts with API access enabled (Binance, Kraken, KuCoin, Bybit, Coinbase — start with 1–2).
- [ ] Generate **read-only** API keys first for data collection + backtesting.
- [ ] Generate **trade-enabled** API keys separately for live mode, with **withdrawals disabled** and **IP-whitelisting enabled** on the exchange.
- [ ] Generate a production `ENCRYPTION_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) — store in a password manager, never commit.
- [ ] Generate a production `API_AUTH_TOKEN` — same rules.
- [ ] Register a domain (Cloudflare ~$10/yr or Porkbun) for the dashboard and API.

### 5.2 Hosting Setup (see §6 for recommendations)

- [ ] Pick a host for data ingestion + API (24/7 worker container). Recommended: Oracle Cloud Always Free or Hetzner Cloud €4/mo.
- [ ] Pick a host for the frontend. Recommended: Vercel free tier or Cloudflare Pages.
- [ ] Pick a managed Postgres (with TimescaleDB if possible). Recommended: self-hosted TimescaleDB on the VPS, _or_ Supabase free (no TimescaleDB, you lose hypertables) _or_ Timescale Cloud Free Trial.
- [ ] Pick a Redis provider. Recommended: Upstash free tier or self-hosted alongside Postgres.
- [ ] Set up DNS records pointing domain → host.
- [ ] Set up SSL via Caddy/Traefik/Cloudflare Tunnel.

### 5.3 Third-Party Services (all have free tiers)

- [ ] Sentry account (5k errors/mo free).
- [ ] Grafana Cloud account (50GB Loki logs, 10k Prometheus series, 14d traces free).
- [ ] Cloudflare account (CDN, DNS, Tunnel — all free).
- [ ] Discord or Telegram webhook for alerts.
- [ ] Cloudflare R2 or Backblaze B2 for Postgres backups.
- [ ] GitHub account for CI runners (already have).

### 5.4 Legal & Risk

- [ ] Review exchange ToS — many prohibit bot trading without disclosure; confirm your jurisdiction allows it.
- [ ] Tax implications: spot-trading P&L is typically reportable — export trade history to CSV each quarter.
- [ ] Start with paper trading only until backtests match paper results within tolerance.
- [ ] Define personal risk limits: max capital deployed, max loss per day, max bots running.

## 6. Hosting Recommendations (Free → Cheap)

Your specific need is **24/7 data ingestion + workers** — the frontend is secondary. Ranked by cost and fit:

### Best: Oracle Cloud Always Free (_genuinely_ free, not trial)

- **4 ARM Ampere cores, 24 GB RAM, 200 GB storage, 10 TB egress/mo** — permanently free, no card charges.
- Runs the whole stack in Docker Compose: API, workers, Postgres/TimescaleDB, Redis.
- Caveats: US/EU regions fill up, need to keep trying at odd hours to provision; account verification requires a valid card (won't be charged); Oracle will reclaim instances that are idle — keep CPU > 5% with a real workload.
- Guide: search "oracle cloud always free tier setup arm".
- **This is the recommendation** for the kind of always-on bot workload you described.

### Second: Hetzner Cloud (very cheap, very reliable)

- €4.15/mo for CX22 (2 vCPU, 4 GB RAM, 40 GB SSD, 20 TB traffic).
- €8.28/mo for CX32 (4 vCPU, 8 GB RAM) — plenty for this workload.
- No free tier but the price is honest, no egress trickery.
- German/Finnish datacenters; US available but slightly more expensive.
- Pair with `hcloud` CLI for easy provisioning.

### Third: Fly.io

- Free allowance covers ~3 shared-cpu-1x VMs with 256MB RAM each — enough for API + one worker but not Postgres.
- Fly Postgres: no free tier since late 2024 (~$1.94/mo smallest).
- Best fit if you want global deploys and already know how to use it; otherwise Hetzner is simpler.

### Fourth: Railway

- $5/mo hobby tier with $5 in usage credits monthly. Easy deploys from Git.
- Good for API + Postgres + Redis in one place.
- Caveat: usage model can get expensive if a bot hits CPU hard.

### Frontend-Only Hosts (free, perfect for the Next.js app)

- **Vercel** — best Next.js DX, generous free tier, zero config.
- **Cloudflare Pages** — free unlimited bandwidth, Workers for edge logic, slower cold starts.
- **Netlify** — comparable to Vercel, less Next.js-optimised.

### Managed Postgres (with TimescaleDB)

- **Timescale Cloud** — 30-day trial then ~$30/mo minimum. Best if you want managed timeseries.
- **Supabase** — 500 MB free, no TimescaleDB. You'd lose hypertable performance but gain managed auth + storage + realtime. Viable if you switch schema to plain PG.
- **Neon** — 512 MB free serverless Postgres, no TimescaleDB, great DX.
- **Self-host on Oracle/Hetzner** — no limits, no managed backups. Best TCO if you'll run backups yourself.

### Managed Redis

- **Upstash** — 10k commands/day free, pay-as-you-go after. Fine for BullMQ if jobs are infrequent.
- **Railway / Fly.io** — bundled with their platform.
- **Self-host** — add the Redis container to your Docker Compose on the VPS.

### Recommended Stack (Zero to $5/mo)

**Option A — "Truly free":**

- Oracle Cloud Always Free VPS running Docker Compose (API + workers + TimescaleDB + Redis).
- Vercel free tier for the Next.js frontend.
- Cloudflare free tier for DNS, CDN, Tunnel.
- Sentry + Grafana Cloud + Upstash free tiers for ops.
- **Cost: $0/mo** (plus ~$10/yr domain).

**Option B — "Cheap, simple, reliable":**

- Hetzner Cloud CX22 (€4/mo) running the same Docker Compose.
- Everything else same as Option A.
- **Cost: ~$5/mo** + domain.

Option B is what I'd pick in your shoes — Oracle's always-free tier is quirky and the terms can shift. €4/mo for a clean, fast, reliable box is worth it.

## 7. Priority Ordering (Suggested)

1. **Week 1 — Unbreak things.** CF-1 through CF-6 (critical wiring). OP-3 (health check includes real deps). T-1 (one end-to-end Playwright smoke test).
2. **Week 2 — Production hosting.** External §5.1, §5.2, §5.3. Deploy to chosen host. OP-6 backups configured. OP-4 alerts wired.
3. **Week 3 — Safety.** LT-1 through LT-8 (live-trading safeguards). BE-14, BE-15 (FKs + soft deletes).
4. **Week 4 — UX polish.** FE-1 through FE-12 (toasts, loading, empty states, responsive, portfolio pie).
5. **Week 5+ — Depth.** Multi-exchange (DP-2), WebSocket streaming (DP-1), more strategies (BE-7), observability (OP-1, OP-2, OP-5), accessibility (FE-8).

## 8. How to Verify This Plan

Each task has an obvious success condition but the overall product should be verified as:

- [ ] `pnpm docker:up && pnpm dev` launches the entire stack cleanly.
- [ ] Create a bot via the UI → run a backtest → view equity curve.
- [ ] Start the bot in paper mode → see at least one trade appear in `/history`.
- [ ] `/health` returns 200 with DB + Redis + exchange all green.
- [ ] Kill a worker mid-job → on restart the job resumes and the trade isn't duplicated.
- [ ] Deploy to the chosen host → visit the domain → all pages render → socket reconnects after VPN switch.
- [ ] Trigger an intentional error → Sentry receives it → Discord alert fires.
- [ ] Run `pg_dump` → restore to a scratch DB → app boots against it.

---
