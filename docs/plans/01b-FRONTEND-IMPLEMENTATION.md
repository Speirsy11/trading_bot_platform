# Frontend Dashboard — Implementation Plan

## Agent System Prompt

```
You are a senior frontend developer specialising in React, Next.js, and TypeScript.
You build high-performance, real-time dashboards for financial applications. You have
deep expertise in data visualisation, WebSocket-based live updates, and creating
professional trading terminal UIs. You follow test-driven development — writing tests
before implementation. You prioritise performance, accessibility, and clean component
architecture. You work within a Turborepo monorepo and consume a tRPC API from a
Fastify backend.
```

---

## Task Prompt

```
Your task is to build the web dashboard for the crypto trading bot platform. This is
Phase 5 (final phase) — the monorepo scaffolding, database layer, trading engine, and
backend API server have all been completed. You have a fully functional Fastify backend
with tRPC routers and Socket.IO hub ready to consume.

IMPORTANT — UI Theme: Before starting, check apps/web/wireframes/screenshots/catalog.html
and read any notes left by the user about which theme was chosen. The wireframe agent
(01a) previously created 5 theme options. Apply the chosen theme's colour palette,
typography, spacing, and visual style throughout the entire application. If no theme
choice is documented, check the wireframe directories under apps/web/wireframes/ to
see which themes were created, and ask the user which one to use before proceeding.

Specifically, you must:

1. Set up the Next.js 15 app (apps/web) following the project structure in Section 3:
   - Initialise shadcn/ui (dark mode by default, Tailwind CSS 4).
   - Set up providers: TRPCProvider, SocketProvider, ThemeProvider (Section 3, providers/).
   - Create the root layout with sidebar navigation and header (layout/Sidebar.tsx, Header.tsx).
   - Configure the tRPC client in lib/trpc.ts pointing at the backend URL.
   - Create the Socket.IO client singleton in lib/socket.ts.
   - Apply the chosen wireframe theme to the Tailwind config, shadcn/ui theme, and
     all custom component styles. The wireframe HTML/CSS files in apps/web/wireframes/
     are your visual reference — match them.

2. Build ALL 8 pages described in Section 4:
   - Dashboard Overview (/dashboard) — Section 4.1: react-grid-layout with portfolio
     summary, allocation pie chart, active bot cards, market overview, mini sparklines,
     recent trades. Persist layout to localStorage.
   - Bot Management (/bots) — Section 4.2: bot list table with TanStack Table, filters,
     sorting. Individual bot detail page with control panel, metrics, equity curve, trade
     history, candlestick chart with entry/exit markers, logs.
   - Create Bot Wizard (/bots/new) — Section 4.3: multi-step form (React Hook Form + Zod)
     with strategy selection, parameter config, exchange/pair selection, risk management,
     mode selection, review & create.
   - Backtesting (/backtest) — Section 4.4: configuration form, results page with equity
     curve, drawdown chart, monthly returns heatmap, trade list, candlestick chart with
     trade markers.
   - Trading Terminal (/trading) — Section 4.5: professional layout with large TradingView
     candlestick chart (multi-timeframe, indicator overlays), order book, order form,
     open orders, positions.
   - Market Data Browser (/market-data) — Section 4.6: browse local data, preview charts,
     coverage indicators, export page with format selection and progress tracking.
   - Trade History (/history) — Section 4.7: full trade table with advanced filtering,
     CSV export, aggregate statistics.
   - Settings (/settings) — Section 4.8: theme, defaults, exchange API key management
     (add keys, test connection, enable/disable, delete).

3. Implement real-time data hooks (Section 5):
   - useTicker: Socket.IO subscription for price updates, updates TanStack Query cache.
   - useBotStatus: real-time bot state changes.
   - usePortfolio: portfolio value and position updates.
   - useWebSocket: Socket.IO connection lifecycle management.
   Follow the integration pattern shown in Section 5.

4. Build chart components (Section 6):
   - CandlestickChart: TradingView Lightweight Charts wrapper with proper React lifecycle,
     real-time candle updates via series.update(), indicator overlays.
   - Portfolio charts: ECharts (pie, area, heatmap) via echarts-for-react.
   - Equity curve and drawdown charts for backtest results.

5. Implement all Zustand stores:
   - ui store: theme, sidebar state, selected symbol.
   - layout store: dashboard grid layout persistence.

6. Create shared utilities in lib/format.ts:
   - Number formatting (currency, percentages, compact notation).
   - Date formatting with timezone display.
   - Consistent profit/loss colour coding.

7. Apply the chosen wireframe theme consistently:
   - Translate the wireframe's CSS colour palette into Tailwind CSS custom properties
     and shadcn/ui theme variables in globals.css.
   - Match the wireframe's background layering, text hierarchy, and accent colours.
   - Ensure chart themes (TradingView, ECharts) match the chosen theme.
   - Support dark/light mode toggle only if the chosen wireframe includes it.

8. Write comprehensive tests (Section 7):
   - Unit tests (Vitest + RTL) for every component and hook. Test rendering, user
     interactions, loading/error/empty states, accessibility.
   - Hook tests for tRPC query hooks and Socket.IO subscription lifecycle.
   - E2E tests (Playwright) for the 6 critical flows listed in Section 7.
   - Co-locate test files with components (BotCard.tsx → BotCard.test.tsx).

9. Follow the implementation notes in Section 9:
   - Optimistic updates for bot start/stop.
   - Error boundaries around each page section.
   - React Suspense for loading states.
   - Virtualise long lists with @tanstack/react-virtual.
   - Memoize chart components. Lazy load heavy pages.

Follow TDD: write failing tests first, then implement. Use the tRPC types from the
backend for full end-to-end type safety — do not duplicate type definitions.

Refer to 00-ARCHITECTURE.md for the overall vision, 02-BACKEND.md for the tRPC router
signatures and Socket.IO event contracts. Do NOT modify the backend or any packages.
When done, delete the apps/web/wireframes/ directory as it is no longer needed.
```

---

## 1. Overview

Build the **web dashboard** (`apps/web`) for the crypto trading bot platform. This is a Next.js application that provides:

- Real-time portfolio and bot monitoring
- Interactive trading charts with technical indicators
- Bot configuration and management (create, start, stop, pause)
- Backtest configuration and results visualisation
- Trade history and order management
- Market data browsing and export
- Exchange API key management

The dashboard communicates with the Fastify backend via **tRPC** (type-safe RPC) for request/response operations and **Socket.IO** for real-time streaming data.

The visual theme is determined by the wireframe chosen during Phase 01a. The implementation agent should reference the wireframe HTML/CSS files as the source of truth for colours, typography, spacing, and component styling.

---

## 2. Technology Stack

| Concern          | Library                                | Version Guidance | Notes                                                       |
| ---------------- | -------------------------------------- | ---------------- | ----------------------------------------------------------- |
| Framework        | **Next.js 15** (App Router)            | Latest stable    | Client-heavy SPA sections; SSR for initial shell            |
| UI Components    | **shadcn/ui**                          | Latest           | Copy-paste into `components/ui/`; built on Radix + Tailwind |
| Styling          | **Tailwind CSS 4**                     | Latest           | Dark mode by default (traders prefer dark themes)           |
| Financial Charts | **TradingView Lightweight Charts**     | `^5.x`           | Candlestick, line, area charts; 16KB                        |
| Dashboard Charts | **Apache ECharts**                     | `^5.x`           | Pie charts, heatmaps, area charts for portfolio             |
| State (client)   | **Zustand**                            | `^5.x`           | UI state: selected symbol, theme, layout preferences        |
| State (server)   | **TanStack Query**                     | `^5.x`           | All server data; auto-refetch, caching, optimistic updates  |
| API Client       | **tRPC React**                         | `^11.x`          | End-to-end type-safe API calls to Fastify backend           |
| Real-time        | **Socket.IO Client**                   | `^4.x`           | Price feeds, bot status updates, trade notifications        |
| Data Tables      | **TanStack Table**                     | `^8.x`           | Headless; used with shadcn/ui table components              |
| Dashboard Layout | **react-grid-layout**                  | `^2.x`           | Draggable/resizable widget panels                           |
| Forms            | **React Hook Form** + **Zod**          | Latest           | Type-safe form validation                                   |
| Date Handling    | **date-fns**                           | Latest           | Lightweight date formatting                                 |
| Testing (unit)   | **Vitest** + **React Testing Library** | Latest           | TDD for all components and hooks                            |
| Testing (E2E)    | **Playwright**                         | Latest           | Critical user flows                                         |

---

## 3. Project Structure

```
apps/web/
├── public/
│   └── favicon.ico
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (providers, sidebar)
│   │   ├── page.tsx                  # Dashboard overview (redirect or home)
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Main dashboard / portfolio overview
│   │   ├── bots/
│   │   │   ├── page.tsx              # Bot list & management
│   │   │   ├── [botId]/
│   │   │   │   └── page.tsx          # Individual bot detail
│   │   │   └── new/
│   │   │       └── page.tsx          # Create new bot wizard
│   │   ├── backtest/
│   │   │   ├── page.tsx              # Backtest configuration
│   │   │   └── [backtestId]/
│   │   │       └── page.tsx          # Backtest results view
│   │   ├── trading/
│   │   │   └── page.tsx              # Live trading terminal
│   │   ├── market-data/
│   │   │   ├── page.tsx              # Market data browser
│   │   │   └── export/
│   │   │       └── page.tsx          # Data export manager
│   │   ├── history/
│   │   │   └── page.tsx              # Trade history & orders
│   │   └── settings/
│   │       ├── page.tsx              # General settings
│   │       └── exchanges/
│   │           └── page.tsx          # Exchange API key management
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   └── ...
│   │   ├── charts/
│   │   │   ├── CandlestickChart.tsx  # TradingView Lightweight Charts wrapper
│   │   │   ├── PortfolioPieChart.tsx # ECharts allocation pie
│   │   │   ├── EquityCurve.tsx       # ECharts line chart for backtest equity
│   │   │   ├── PerformanceChart.tsx  # ECharts area chart for returns
│   │   │   └── DrawdownChart.tsx     # Max drawdown visualisation
│   │   ├── dashboard/
│   │   │   ├── DashboardGrid.tsx     # react-grid-layout wrapper
│   │   │   ├── PortfolioSummary.tsx  # Total value, PnL, allocation
│   │   │   ├── BotStatusCards.tsx    # Active bots quick status
│   │   │   ├── MarketOverview.tsx    # Top movers, volume leaders
│   │   │   └── RecentTrades.tsx      # Latest executed trades
│   │   ├── bots/
│   │   │   ├── BotCard.tsx           # Individual bot status card
│   │   │   ├── BotConfigForm.tsx     # Create/edit bot configuration
│   │   │   ├── BotControlPanel.tsx   # Start/stop/pause controls
│   │   │   └── BotMetrics.tsx        # Performance metrics for a bot
│   │   ├── backtest/
│   │   │   ├── BacktestConfig.tsx    # Backtest parameter form
│   │   │   ├── BacktestResults.tsx   # Results summary with metrics
│   │   │   └── TradeList.tsx         # Table of simulated trades
│   │   ├── trading/
│   │   │   ├── OrderForm.tsx         # Place order (market/limit/stop)
│   │   │   ├── OrderBook.tsx         # Real-time bid/ask display
│   │   │   ├── SymbolSelector.tsx    # Search & select trading pair
│   │   │   └── TimeframeSelector.tsx # Timeframe switcher
│   │   └── layout/
│   │       ├── Sidebar.tsx           # Navigation sidebar
│   │       ├── Header.tsx            # Top bar with search, notifications
│   │       └── ThemeToggle.tsx       # Dark/light mode switch
│   │
│   ├── hooks/
│   │   ├── useMarketData.ts          # TanStack Query hook for OHLCV
│   │   ├── useTicker.ts              # Real-time price via Socket.IO
│   │   ├── useBotStatus.ts           # Real-time bot state
│   │   ├── usePortfolio.ts           # Portfolio balances & positions
│   │   └── useWebSocket.ts          # Socket.IO connection management
│   │
│   ├── stores/
│   │   ├── ui.ts                     # Zustand: theme, sidebar state, selected symbol
│   │   └── layout.ts                # Zustand: dashboard grid layout persistence
│   │
│   ├── lib/
│   │   ├── trpc.ts                   # tRPC client configuration
│   │   ├── socket.ts                 # Socket.IO client singleton
│   │   └── format.ts                # Number/date/currency formatters
│   │
│   └── providers/
│       ├── TRPCProvider.tsx          # tRPC + TanStack Query provider
│       ├── SocketProvider.tsx        # Socket.IO context provider
│       └── ThemeProvider.tsx         # next-themes provider
│
├── vitest.config.ts
├── vitest.setup.ts
├── playwright.config.ts
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Pages & Features

### 4.1 Dashboard Overview (`/dashboard`)

The main landing page after opening the app. A customisable grid of widgets.

**Widgets (react-grid-layout):**

- **Portfolio Summary Card** — Total value, 24h change ($ and %), unrealised PnL
- **Allocation Pie Chart** — ECharts pie showing asset distribution
- **Active Bots Status** — Cards showing each running bot: name, strategy, PnL, status indicator (green/yellow/red)
- **Market Overview** — Top gainers/losers, volume leaders (table)
- **Mini Price Charts** — Sparkline charts for watched pairs
- **Recent Trades** — Last 10 executed trades across all bots

**Data Sources:**

- tRPC: `portfolio.getSummary()`, `bots.listActive()`, `trades.getRecent()`
- Socket.IO: `portfolio:update`, `bot:statusChange`, `price:ticker`

**Layout persistence:** Save grid layout to Zustand → localStorage so the user's arrangement persists across sessions.

---

### 4.2 Bot Management (`/bots`)

**Bot List Page:**

- Table (TanStack Table) of all bots with columns: Name, Strategy, Exchange, Symbol, Mode (backtest/paper/live), Status, PnL, Actions
- Filters: by status, exchange, strategy
- Sort by any column
- "Create New Bot" button

**Individual Bot Page (`/bots/[botId]`):**

- **Control Panel** — Start / Pause / Stop buttons with confirmation dialogs
- **Performance Metrics** — Sharpe ratio, max drawdown, win rate, profit factor, total return
- **Equity Curve** — ECharts line chart of bot's equity over time
- **Trade History** — Table of all trades this bot has made
- **Candlestick Chart** — TradingView chart showing the symbol with entry/exit markers overlaid
- **Configuration** — Read-only view of bot params; "Edit" button opens form
- **Logs** — Scrollable log of bot events (trade placed, error, etc.)

---

### 4.3 Create Bot Wizard (`/bots/new`)

Multi-step form (React Hook Form + Zod):

1. **Select Strategy** — Choose from available strategies; show description and parameters
2. **Configure Strategy** — Dynamic form fields based on strategy parameters (e.g., SMA period, RSI threshold)
3. **Select Exchange & Pair** — Dropdown of configured exchanges → dropdown of available pairs
4. **Risk Management** — Max drawdown %, position size %, stop-loss %, max concurrent positions
5. **Mode Selection** — Backtest / Paper / Live with warnings for live mode
6. **Review & Create** — Summary of all settings; "Create Bot" button

---

### 4.4 Backtesting (`/backtest`)

**Configuration Page:**

- Select strategy + parameters
- Select exchange and trading pair
- Date range picker (start/end)
- Initial capital input
- Fee configuration (maker/taker %)
- Slippage simulation toggle
- "Run Backtest" button

**Results Page (`/backtest/[backtestId]`):**

- **Summary Card** — Total return, Sharpe, max drawdown, win rate, profit factor, total trades
- **Equity Curve** — ECharts area chart
- **Drawdown Chart** — Inverted area chart showing drawdown periods
- **Monthly Returns Heatmap** — ECharts heatmap of monthly % returns
- **Trade List** — Table with entry/exit price, PnL, duration, type
- **Candlestick Chart** — TradingView chart with trade markers (green ▲ buy, red ▼ sell)
- **Compare** — Ability to overlay multiple backtest results

---

### 4.5 Trading Terminal (`/trading`)

Professional trading terminal layout:

- **Large Candlestick Chart** — TradingView Lightweight Charts with:
  - Multiple timeframe switching (1m, 5m, 15m, 1h, 4h, 1d)
  - Technical indicator overlays (SMA, EMA, Bollinger Bands, RSI as sub-chart)
  - Drawing tools (trend lines, horizontal lines)
- **Order Book** — Real-time bid/ask levels with depth visualisation
- **Order Form** — Market / Limit / Stop-Loss order entry
- **Open Orders** — Table of active orders with cancel button
- **Recent Trades** — Tape of recent market trades
- **Positions** — Current open positions with PnL

---

### 4.6 Market Data Browser (`/market-data`)

- Browse available market data in the local database
- Filter by exchange, symbol, timeframe
- Preview chart of any dataset
- Data completeness indicators (% coverage for date range)
- Gap detection and fill status

**Export Page (`/market-data/export`):**

- Select exchange, symbols (multi-select), timeframe, date range
- Choose export format: CSV, Parquet, SQLite
- Optional compression (gzip)
- Download progress bar
- History of past exports with re-download links

---

### 4.7 Trade History (`/history`)

- Full trade history table across all bots
- Advanced filtering: date range, exchange, symbol, bot, side (buy/sell), PnL range
- Export to CSV
- Aggregate statistics at the top

---

### 4.8 Settings (`/settings`)

**General Settings:**

- Theme (dark/light/system)
- Default currency
- Timezone display preference
- Notification preferences

**Exchange Management (`/settings/exchanges`):**

- Add exchange API keys (form with API key + secret fields)
- Test connection button (validates keys against exchange)
- Enable/disable exchanges
- Show permissions (read-only, trade, etc.)
- Delete exchange configuration (with confirmation)
- API keys are sent to the backend and stored encrypted — **never stored in the browser**

---

## 5. Real-Time Data Architecture

### Socket.IO Events (Client ← Server)

| Event                   | Payload                                                   | Used By                                |
| ----------------------- | --------------------------------------------------------- | -------------------------------------- |
| `price:ticker`          | `{ exchange, symbol, bid, ask, last, volume, change24h }` | Dashboard, Trading Terminal, Bot pages |
| `price:candle`          | `{ exchange, symbol, timeframe, candle: Candle }`         | Trading Terminal chart                 |
| `bot:statusChange`      | `{ botId, status, timestamp }`                            | Bot list, Bot detail                   |
| `bot:trade`             | `{ botId, trade: Trade }`                                 | Bot detail, Recent trades              |
| `bot:metrics`           | `{ botId, metrics: PerformanceMetrics }`                  | Bot detail                             |
| `portfolio:update`      | `{ totalValue, change24h, positions }`                    | Dashboard, Portfolio page              |
| `backtest:progress`     | `{ backtestId, progress: number, currentDate }`           | Backtest results (progress bar)        |
| `data:collectionStatus` | `{ exchange, symbol, status, lastUpdated }`               | Market data browser                    |

### Socket.IO Events (Client → Server)

| Event                | Payload                           | Purpose                       |
| -------------------- | --------------------------------- | ----------------------------- |
| `subscribe:ticker`   | `{ exchange, symbol }`            | Start receiving price updates |
| `unsubscribe:ticker` | `{ exchange, symbol }`            | Stop receiving price updates  |
| `subscribe:candle`   | `{ exchange, symbol, timeframe }` | Live candlestick updates      |
| `subscribe:bot`      | `{ botId }`                       | Bot-specific events           |

### Integration Pattern

```typescript
// hooks/useTicker.ts — example pattern
export function useTicker(exchange: string, symbol: string) {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    socket.emit("subscribe:ticker", { exchange, symbol });

    socket.on("price:ticker", (data) => {
      if (data.exchange === exchange && data.symbol === symbol) {
        // Update TanStack Query cache directly for instant UI updates
        queryClient.setQueryData(["ticker", exchange, symbol], data);
      }
    });

    return () => {
      socket.emit("unsubscribe:ticker", { exchange, symbol });
      socket.off("price:ticker");
    };
  }, [exchange, symbol]);

  return useQuery({
    queryKey: ["ticker", exchange, symbol],
    queryFn: () => trpc.market.getTicker.query({ exchange, symbol }),
    staleTime: 5000,
  });
}
```

---

## 6. Charting Implementation Notes

### TradingView Lightweight Charts

- Wrap in a React component that handles chart lifecycle (create on mount, destroy on unmount).
- Use `useRef` for the chart container div.
- Expose imperative methods via `useImperativeHandle` if parent needs control.
- For real-time candle updates, use `series.update()` (not full re-render).
- Technical indicators: calculate in the backend or in `@tb/indicators` package, render as additional line series overlaid on the main chart.
- Consider using the `createChartEx` API for custom plugins if needed.

### Performance Considerations

- **Virtualise** long lists and tables (TanStack Table supports virtualisation via `@tanstack/react-virtual`).
- **Memoize** chart components aggressively — charts are expensive to re-render.
- **Debounce** WebSocket updates to 100-250ms if CPU usage is high.
- **Lazy load** heavy pages (backtest results, market data browser).
- Use `React.lazy()` + `Suspense` for code splitting chart libraries.

---

## 7. Testing Strategy

### Unit Tests (Vitest + RTL)

Test every component, hook, and utility function. Write tests **before** implementation.

**Component tests focus on:**

- Correct rendering given props
- User interactions trigger correct callbacks
- Loading/error/empty states render correctly
- Accessibility (correct ARIA attributes)

**Hook tests focus on:**

- tRPC query hooks return correct data shapes
- Socket.IO subscription/unsubscription lifecycle
- Zustand store state transitions

### E2E Tests (Playwright)

Cover critical user flows:

1. Dashboard loads with portfolio data
2. Create a new bot → see it in bot list
3. Run a backtest → view results
4. Navigate to trading terminal → chart renders
5. Add an exchange API key → test connection
6. Export market data → download file

### Test File Convention

Every component/hook gets a co-located test file:

```
components/bots/BotCard.tsx
components/bots/BotCard.test.tsx
```

---

## 8. Styling & Theming

- **Use the theme chosen from the 01a wireframe exploration.**
- Translate the wireframe's colour palette into Tailwind CSS custom properties in `globals.css`.
- Configure shadcn/ui theme variables to match.
- Provide dark/light mode toggle if appropriate for the chosen theme.
- **Colour scheme for trading** (adjust to match chosen theme):
  - Profit/up: theme's profit colour
  - Loss/down: theme's loss colour
  - Neutral: theme's muted colour
  - Primary accent: theme's accent colour
- Persist theme preference in localStorage via `next-themes`.
- Chart themes should match the app theme (TradingView Lightweight Charts supports custom colours).

---

## 9. Key Implementation Notes

- **tRPC client** should be configured once in `lib/trpc.ts` with the backend URL from environment variables (`NEXT_PUBLIC_API_URL`).
- **Socket.IO client** should be a singleton created in a React context provider — not instantiated per component.
- **All money values** should use a consistent formatting utility (`lib/format.ts`) that handles locale, decimal places, and currency symbols.
- **Optimistic updates** should be used for bot start/stop operations so the UI feels instant.
- **Error boundaries** should wrap each major page section so a crash in charts doesn't take down the whole dashboard.
- Use **React Suspense** boundaries for loading states on each page.

---

## 10. Dependencies to Install

```bash
# Framework
next react react-dom

# UI
tailwindcss @tailwindcss/postcss
# shadcn/ui (via CLI: npx shadcn@latest init)

# Charts
lightweight-charts
echarts echarts-for-react

# State & Data
zustand
@tanstack/react-query
@tanstack/react-table
@tanstack/react-virtual
@trpc/client @trpc/react-query

# Real-time
socket.io-client

# Layout
react-grid-layout

# Forms
react-hook-form @hookform/resolvers zod

# Utilities
date-fns
next-themes

# Testing
vitest @vitest/ui
@testing-library/react @testing-library/jest-dom @testing-library/user-event
@playwright/test
jsdom
```
