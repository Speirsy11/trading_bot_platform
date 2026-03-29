# Trading Engine & Backtesting — Development Plan

## Agent System Prompt

```
You are a senior quantitative developer specialising in algorithmic trading systems,
backtesting engines, and trading strategy development in TypeScript. You have deep knowledge
of financial markets, technical analysis, order management, risk management, and performance
metrics (Sharpe ratio, drawdown, etc.). You build reliable, well-tested systems where the
same strategy code runs identically in backtesting and live trading. You follow test-driven
development — every strategy, indicator, and order simulation is tested before use. You
understand the pitfalls of backtesting (lookahead bias, overfitting, survivorship bias)
and design systems to avoid them.
```

---

## Task Prompt

```
Your task is to build the trading engine and backtesting system for the crypto trading bot
platform. This is Phase 3 — the monorepo scaffolding (03-INFRASTRUCTURE.md) and the
database/data-pipeline layer (05-DATA-PIPELINE.md) have already been completed. You have
a working @tb/db package with OHLCV schemas and query helpers, and a working @tb/data-pipeline
package that populates the database with market data.

Specifically, you must:

1. Implement the @tb/indicators package (Section 3.2):
   - All indicators listed: SMA, EMA, ADX, RSI, MACD, Stochastic, Bollinger Bands, ATR,
     OBV, VWAP.
   - Use tulind (native C bindings) as the primary calculation engine. Provide pure
     TypeScript fallbacks for environments where tulind compilation fails.
   - Expose a clean IndicatorCalculator class that strategies consume.
   - Test every indicator against known reference values (Section 13) — fixtures with
     hand-calculated or cross-referenced expected outputs.

2. Implement the @tb/trading-core package (Section 3.1):

   a. Exchange abstraction layer (Section 4.1):
      - IExchange interface as specified.
      - BacktestExchange: simulated exchange that processes orders against historical
        candles. Implements all order fill logic from Section 6 (limit, stop, market fills,
        slippage model, fee model).
      - LiveExchange: wraps a CCXT instance, delegates all calls to the real exchange.
      - PaperExchange: uses real market data but simulated order execution.

   b. Strategy system (Section 4.2):
      - IStrategy interface with onCandle(), initialize(), cleanup().
      - StrategyContext that provides exchange, indicators, config, logger.
      - StrategyRegistry for discovering and instantiating strategies.
      - At least 2 example strategies fully implemented and tested:
        * SMACrossover (Section 10) — golden/death cross logic
        * One additional strategy of your choice (RSIMeanReversion or BollingerBounce)

   c. Backtesting engine (Section 5):
      - Event-driven BacktestEngine following the pseudocode in Section 5.2 exactly.
      - BacktestConfig type from Section 5.3.
      - Loads historical data from @tb/db, feeds it candle-by-candle to the strategy.
      - Produces a complete BacktestResult with all metrics.

   d. Order management:
      - OrderManager: tracks order lifecycle (open, filled, cancelled, rejected).
      - PositionManager: tracks open positions and unrealised PnL.
      - OrderSimulator: fill logic for BacktestExchange (Section 6).

   e. Risk management (Section 7):
      - RiskConfig type with all 7 parameters.
      - RiskManager: pre-trade checks (position size, drawdown, concurrent positions,
        daily loss, balance). Rejects orders that violate risk rules.
      - PositionSizer: calculates position size from risk parameters.

   f. Performance metrics (Section 8):
      - MetricsCalculator: computes all 17 metrics listed in Section 8.1.
      - PerformanceTracker: records equity curve data points at each candle.

   g. Bot lifecycle (Section 9):
      - BotStateMachine: INITIALIZED → RUNNING → PAUSED → STOPPING → STOPPED → ERROR.
      - Bot class: wraps strategy + exchange, manages the execution loop.
      - BotRunner: execution loop for live/paper bots (subscribe to candles, invoke strategy).
      - Graceful shutdown: cancel orders, optionally close positions, save state.

3. Write comprehensive tests (Section 12):
   - Unit tests for EVERY component listed in the table.
   - Integration test: full backtest run with SMACrossover on fixture data, verifying
     final equity, trade count, and metrics against hand-calculated expected values.
   - Create test data fixtures: trending up, trending down, sideways, V-recovery,
     flash crash, low volume scenarios.

4. Be vigilant about backtesting pitfalls (Section 11): no lookahead bias, slippage
   simulation enabled by default, maker/taker fee distinction.

Follow TDD: write failing tests first, then implement. The IExchange abstraction is
the most critical piece — it MUST work identically for backtest and live trading.

Refer to 00-ARCHITECTURE.md for shared types and 05-DATA-PIPELINE.md for how data
is stored and queried. Do NOT build the API server, workers, or frontend.
```

---

## 1. Overview

Build the **trading engine** — a set of packages that power both backtesting and live trading:

- **`@tb/trading-core`** — Backtesting engine, exchange abstraction (IExchange), strategy interface, bot lifecycle management, order management, risk management, performance metrics
- **`@tb/indicators`** — Technical indicator calculations (SMA, EMA, RSI, MACD, Bollinger Bands, etc.)

The critical design principle: **the same strategy code must run without modification in backtesting, paper trading, and live trading**. This is achieved through the `IExchange` abstraction layer.

---

## 2. Technology Stack

| Concern | Library | Notes |
|---|---|---|
| Technical Indicators | **tulind** (`tulipnode`) | C-native bindings, 100+ indicators, fastest option |
| Indicator Fallback | Custom TypeScript implementations | For environments where tulind compilation fails |
| Statistics | **simple-statistics** | Sharpe ratio, standard deviation, correlation |
| Exchange API | **CCXT** | Used exclusively by the `LiveExchange` adapter |
| Validation | **Zod** | Strategy config and order validation |
| Testing | **Vitest** | TDD for all logic |
| UUID | **crypto.randomUUID()** | Built-in; no external dependency |

---

## 3. Package Structure

### 3.1 `@tb/trading-core`

```
packages/trading-core/
├── src/
│   ├── index.ts                     # Public API exports
│   │
│   ├── exchange/
│   │   ├── IExchange.ts             # Exchange abstraction interface
│   │   ├── BacktestExchange.ts      # Simulated exchange for backtesting
│   │   ├── LiveExchange.ts          # Real exchange wrapper (uses CCXT)
│   │   ├── PaperExchange.ts         # Paper trading (real data, simulated orders)
│   │   └── types.ts                 # Order, Balance, Position types
│   │
│   ├── strategy/
│   │   ├── IStrategy.ts             # Strategy interface contract
│   │   ├── StrategyContext.ts       # Context object passed to strategies
│   │   ├── StrategyRegistry.ts      # Registry of available strategies
│   │   └── strategies/
│   │       ├── SMACrossover.ts      # Example: SMA crossover strategy
│   │       ├── RSIMeanReversion.ts  # Example: RSI mean reversion
│   │       ├── BollingerBounce.ts   # Example: Bollinger Band bounce
│   │       ├── GridTrading.ts       # Example: Grid trading
│   │       └── DCA.ts              # Example: Dollar cost averaging
│   │
│   ├── backtest/
│   │   ├── BacktestEngine.ts        # Main backtesting loop (event-driven)
│   │   ├── BacktestConfig.ts        # Configuration types
│   │   └── BacktestResult.ts        # Result aggregation
│   │
│   ├── bot/
│   │   ├── Bot.ts                   # Bot class (wraps strategy + exchange)
│   │   ├── BotStateMachine.ts       # State transitions (init → running → paused → stopped)
│   │   └── BotRunner.ts             # Execution loop for live/paper bots
│   │
│   ├── orders/
│   │   ├── OrderManager.ts          # Order tracking and lifecycle
│   │   ├── PositionManager.ts       # Open position tracking
│   │   └── OrderSimulator.ts        # Simulated order fills for backtesting
│   │
│   ├── risk/
│   │   ├── RiskManager.ts           # Risk checks before order placement
│   │   └── PositionSizer.ts         # Calculate position size from risk params
│   │
│   ├── metrics/
│   │   ├── PerformanceTracker.ts    # Track equity curve and daily returns
│   │   ├── MetricsCalculator.ts     # Sharpe, Sortino, drawdown, win rate, etc.
│   │   └── types.ts                 # BacktestResults, PerformanceMetrics types
│   │
│   └── utils/
│       ├── timeframe.ts             # Timeframe utilities (parse, convert)
│       └── decimal.ts               # Precise decimal arithmetic for money
│
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

### 3.2 `@tb/indicators`

```
packages/indicators/
├── src/
│   ├── index.ts                     # Public API exports
│   ├── calculator.ts                # Main indicator calculator class
│   ├── trend/
│   │   ├── sma.ts                   # Simple Moving Average
│   │   ├── ema.ts                   # Exponential Moving Average
│   │   └── adx.ts                   # Average Directional Index
│   ├── momentum/
│   │   ├── rsi.ts                   # Relative Strength Index
│   │   ├── macd.ts                  # MACD
│   │   └── stochastic.ts           # Stochastic Oscillator
│   ├── volatility/
│   │   ├── bollingerBands.ts        # Bollinger Bands
│   │   └── atr.ts                   # Average True Range
│   ├── volume/
│   │   ├── obv.ts                   # On-Balance Volume
│   │   └── vwap.ts                  # Volume-Weighted Average Price
│   └── types.ts                     # Shared indicator types
│
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Core Interfaces

### 4.1 Exchange Abstraction (`IExchange`)

This is the foundation that enables unified backtest/live code:

```typescript
interface IExchange {
  // Market data
  fetchOHLCV(symbol: string, timeframe: string, since?: number, limit?: number): Promise<Candle[]>;
  fetchTicker(symbol: string): Promise<Ticker>;
  fetchOrderBook(symbol: string, limit?: number): Promise<OrderBook>;

  // Account
  fetchBalance(): Promise<Balance>;
  fetchOpenOrders(symbol?: string): Promise<Order[]>;
  fetchClosedOrders(symbol?: string, since?: number, limit?: number): Promise<Order[]>;

  // Trading
  createOrder(symbol: string, type: OrderType, side: OrderSide, amount: number, price?: number): Promise<Order>;
  cancelOrder(orderId: string, symbol?: string): Promise<void>;

  // Info
  getExchangeId(): string;
  getAvailableSymbols(): Promise<string[]>;
}
```

### 4.2 Strategy Interface (`IStrategy`)

```typescript
interface IStrategy {
  /** Human-readable strategy name */
  readonly name: string;

  /** Describe the strategy and its parameters */
  readonly description: string;

  /** Zod schema for strategy-specific parameters */
  readonly paramsSchema: z.ZodSchema;

  /** Called once when the bot starts; initialise state, load indicators */
  initialize(ctx: StrategyContext): Promise<void>;

  /** Called on each new completed candle — the main decision point */
  onCandle(candle: Candle, history: Candle[]): Promise<Signal[]>;

  /** Called when the bot is shutting down; close positions, clean up */
  cleanup(): Promise<void>;
}

enum SignalAction {
  BUY = "BUY",
  SELL = "SELL",
  CLOSE_LONG = "CLOSE_LONG",
  CLOSE_SHORT = "CLOSE_SHORT",
  NEUTRAL = "NEUTRAL",
}

interface Signal {
  action: SignalAction;
  symbol: string;
  orderType: OrderType;       // market, limit, stop
  price?: number;             // Required for limit/stop orders
  amount?: number;            // If undefined, use PositionSizer
  stopLoss?: number;
  takeProfit?: number;
  reason?: string;            // Human-readable reason for logging
}
```

### 4.3 Strategy Context

```typescript
interface StrategyContext {
  exchange: IExchange;
  config: StrategyConfig;
  indicators: IndicatorCalculator;  // From @tb/indicators
  logger: Logger;
  
  // Convenience accessors
  getBalance(): Promise<Balance>;
  getPositions(): Promise<Position[]>;
  getOpenOrders(): Promise<Order[]>;
}
```

---

## 5. Backtesting Engine

### 5.1 Architecture: Event-Driven

The backtesting engine processes historical candles **one at a time**, simulating real-time trading. This is chosen over vectorized backtesting because:

- Same code runs in live trading without modification
- Proper state management (positions, balance, pending orders)
- Realistic order fill simulation with slippage and fees
- Better for strategies that depend on order state

### 5.2 Backtesting Loop (Pseudocode)

```
1. Load historical candles from database for [startDate, endDate]
2. Create BacktestExchange with initial balance
3. Instantiate strategy with BacktestExchange
4. Call strategy.initialize()
5. For each candle (chronological):
   a. BacktestExchange.advanceTime(candle.time)
   b. Process pending limit/stop orders against new candle's OHLC
   c. Update position PnL with current prices
   d. Build history window (last N candles)
   e. signals = strategy.onCandle(candle, history)
   f. For each signal:
      - Run through RiskManager checks
      - Calculate position size via PositionSizer
      - Execute via BacktestExchange.createOrder()
   g. Track equity and record metrics
6. Call strategy.cleanup()
7. Calculate final PerformanceMetrics
8. Return BacktestResult
```

### 5.3 Backtest Configuration

```typescript
interface BacktestConfig {
  strategyName: string;
  strategyParams: Record<string, unknown>;
  exchange: string;           // Which exchange data to use
  symbol: string;
  timeframe: string;
  startDate: number;          // Unix timestamp
  endDate: number;
  initialBalance: number;     // In quote currency (e.g., USDT)
  fees: {
    maker: number;            // e.g., 0.001 = 0.1%
    taker: number;            // e.g., 0.001 = 0.1%
  };
  slippage: {
    enabled: boolean;
    percentage: number;       // e.g., 0.0005 = 0.05%
  };
  riskConfig: RiskConfig;
}
```

---

## 6. Order Simulation (BacktestExchange)

### 6.1 Simulated Order Fills

When a new candle arrives, the BacktestExchange checks all pending orders:

- **Limit buy** fills if `candle.low <= order.price`
- **Limit sell** fills if `candle.high >= order.price`
- **Stop-loss (sell)** triggers if `candle.low <= order.stopPrice`
- **Stop-loss (buy)** triggers if `candle.high >= order.stopPrice`
- **Market orders** fill immediately at the current candle's open price (with slippage)

### 6.2 Slippage Model

```
fillPrice = order.price ± (order.price × slippagePercentage)
```

- Buy orders: fill price is HIGHER than target (worse for buyer)
- Sell orders: fill price is LOWER than target (worse for seller)
- Market orders get more slippage than limit orders

### 6.3 Fee Model

```
fee = filledAmount × fillPrice × feePercentage
```

- Market orders pay taker fee
- Limit orders pay maker fee
- Fees are deducted from the balance

---

## 7. Risk Management

### 7.1 RiskConfig

```typescript
interface RiskConfig {
  maxPositionSizePercent: number;     // Max % of portfolio in one position (e.g., 10%)
  maxDrawdownPercent: number;         // Stop bot if drawdown exceeds this (e.g., 20%)
  riskPerTradePercent: number;        // Risk per trade (e.g., 2%)
  maxConcurrentPositions: number;     // Max open positions at once
  maxDailyLossPercent: number;        // Stop trading if daily loss exceeds this
  trailingStopEnabled: boolean;       // Auto-adjust stop-loss as price moves
  trailingStopPercent: number;        // Distance from peak (e.g., 5%)
}
```

### 7.2 Pre-Trade Risk Checks

Before any order is placed, RiskManager verifies:

1. **Position size** doesn't exceed `maxPositionSizePercent` of portfolio
2. **Portfolio drawdown** hasn't exceeded `maxDrawdownPercent`
3. **Number of open positions** doesn't exceed `maxConcurrentPositions`
4. **Daily loss** hasn't exceeded `maxDailyLossPercent`
5. **Sufficient balance** exists for the order

If any check fails, the order is rejected and logged.

### 7.3 Position Sizing

The `PositionSizer` calculates how much to buy/sell based on:

```
riskAmount = portfolioValue × riskPerTradePercent
positionSize = riskAmount / (entryPrice - stopLossPrice)
```

This ensures each trade risks a consistent percentage of the portfolio.

---

## 8. Performance Metrics

### 8.1 Metrics to Calculate

| Metric | Formula | Target |
|---|---|---|
| **Total Return** | `(endBalance - startBalance) / startBalance × 100` | — |
| **CAGR** | `(endBalance / startBalance)^(1/years) - 1` | — |
| **Net Profit** | `endBalance - startBalance` | — |
| **Sharpe Ratio** | `(annualizedReturn - riskFreeRate) / annualizedStdDev` | > 1.0 |
| **Sortino Ratio** | `(annualizedReturn - riskFreeRate) / downsideStdDev` | > 1.5 |
| **Calmar Ratio** | `annualizedReturn / maxDrawdown` | > 1.0 |
| **Max Drawdown** | Worst peak-to-trough decline | < 20% |
| **Win Rate** | `winningTrades / totalTrades × 100` | > 50% |
| **Profit Factor** | `grossProfit / grossLoss` | > 1.5 |
| **Average Win** | Mean profit of winning trades | — |
| **Average Loss** | Mean loss of losing trades | — |
| **Risk/Reward** | `averageWin / averageLoss` | > 1.5 |
| **Expectancy** | `(winRate × avgWin) - (lossRate × avgLoss)` | > 0 |
| **Total Trades** | Count of all closed trades | — |
| **Avg Hold Time** | Mean duration of positions | — |
| **Win/Loss Streaks** | Longest consecutive wins/losses | — |

### 8.2 Equity Curve Tracking

The `PerformanceTracker` records the portfolio value at each candle to build:

- **Equity curve** — Array of `{ time, equity }` for charting
- **Daily returns** — Array of daily percentage returns for Sharpe/Sortino calculations
- **Drawdown curve** — Array of `{ time, drawdownPercent }` for drawdown chart

---

## 9. Bot Lifecycle

### 9.1 State Machine

```
                     ┌──────────────┐
                     │  INITIALIZED │
                     └──────┬───────┘
                            │ start()
                     ┌──────▼───────┐
              ┌──────│   RUNNING    │──────┐
              │      └──────┬───────┘      │
              │ pause()     │ error        │ stop()
       ┌──────▼───────┐    │       ┌──────▼───────┐
       │    PAUSED     │    │       │   STOPPING   │
       └──────┬───────┘    │       └──────┬───────┘
              │ resume()   │              │ (graceful)
              │      ┌─────▼──────┐       │
              └──────►  RUNNING   │       │
                     └────────────┘       │
                                   ┌──────▼───────┐
                            ┌──────│   STOPPED    │
                            │      └──────────────┘
                            │
                     ┌──────▼───────┐
                     │    ERROR     │──── restart → INITIALIZED
                     └──────────────┘
```

### 9.2 Graceful Shutdown

When a bot is stopped:
1. Stop processing new candles
2. Cancel all pending orders
3. Optionally close all open positions (configurable)
4. Save final state to database
5. Calculate and store final metrics
6. Publish `bot:stopped` event

### 9.3 Crash Recovery

If a bot worker crashes:
1. BullMQ retries the job automatically
2. Bot loads last known state from database
3. Resumes from last processed candle
4. Logs recovery event

---

## 10. Example Strategy Implementation

### SMA Crossover Strategy

```typescript
// This is an example of how strategies should be structured.
// The agent implementing this should follow this pattern.

class SMACrossover implements IStrategy {
  readonly name = "SMA Crossover";
  readonly description = "Buy when fast SMA crosses above slow SMA, sell on cross below";
  
  readonly paramsSchema = z.object({
    fastPeriod: z.number().int().min(2).max(200).default(9),
    slowPeriod: z.number().int().min(5).max(500).default(21),
  });

  private ctx!: StrategyContext;
  private params!: { fastPeriod: number; slowPeriod: number };
  private prevFastSMA: number | null = null;
  private prevSlowSMA: number | null = null;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const closes = history.map((c) => c.close);
    
    if (closes.length < this.params.slowPeriod) {
      return []; // Not enough data yet
    }

    const fastSMA = this.ctx.indicators.sma(closes, this.params.fastPeriod);
    const slowSMA = this.ctx.indicators.sma(closes, this.params.slowPeriod);

    const currentFast = fastSMA[fastSMA.length - 1];
    const currentSlow = slowSMA[slowSMA.length - 1];
    const signals: Signal[] = [];

    if (this.prevFastSMA !== null && this.prevSlowSMA !== null) {
      // Golden cross: fast SMA crosses above slow SMA
      if (this.prevFastSMA <= this.prevSlowSMA && currentFast > currentSlow) {
        signals.push({
          action: SignalAction.BUY,
          symbol: this.ctx.config.symbol,
          orderType: OrderType.MARKET,
          reason: `Golden cross: SMA(${this.params.fastPeriod}) crossed above SMA(${this.params.slowPeriod})`,
        });
      }

      // Death cross: fast SMA crosses below slow SMA
      if (this.prevFastSMA >= this.prevSlowSMA && currentFast < currentSlow) {
        signals.push({
          action: SignalAction.CLOSE_LONG,
          symbol: this.ctx.config.symbol,
          orderType: OrderType.MARKET,
          reason: `Death cross: SMA(${this.params.fastPeriod}) crossed below SMA(${this.params.slowPeriod})`,
        });
      }
    }

    this.prevFastSMA = currentFast;
    this.prevSlowSMA = currentSlow;

    return signals;
  }

  async cleanup(): Promise<void> {
    // Nothing to clean up for this simple strategy
  }
}
```

---

## 11. Backtesting Pitfalls to Avoid

### 11.1 Lookahead Bias

**Problem**: Using data that wouldn't be available at the time of the decision.

**Prevention**:
- `onCandle()` receives a **completed** candle plus history of **previous** candles only.
- The current candle's close price represents the CLOSE of the previous period, not the current unfinished candle.
- The BacktestEngine enforces this by only providing completed candles.

### 11.2 Overfitting

**Problem**: Optimising strategy parameters to fit historical data so well that they fail on new data.

**Prevention**:
- Split data into training (70%) and validation (30%) periods.
- Display both in-sample and out-of-sample results.
- Limit the number of tunable parameters.
- Use walk-forward analysis: train on period 1, test on period 2, retrain on period 1+2, test on period 3, etc.

### 11.3 Survivorship Bias

**Problem**: Only backtesting on assets that survived (exist today).

**Prevention**:
- Store and use historical data including delisted assets.
- Filter available pairs by what was tradeable at each point in time.

### 11.4 Unrealistic Fills

**Problem**: Assuming orders always fill at the exact requested price.

**Prevention**:
- Implement slippage simulation in `BacktestExchange`.
- Use maker/taker fee differentiation.
- Check candle volume — don't fill orders larger than a fraction of the candle's volume.

---

## 12. Testing Strategy

### Unit Tests for Every Component

| Component | What to Test |
|---|---|
| `BacktestExchange` | Order fills (market, limit, stop), fee calculation, slippage, balance tracking, edge cases (insufficient funds, cancelled orders) |
| `OrderSimulator` | Fill logic against different candle patterns |
| `PositionManager` | Open/close/update positions, PnL calculation |
| `RiskManager` | Each risk check independently, combined checks |
| `PositionSizer` | Position size calculation for various risk configs |
| `MetricsCalculator` | Each metric against known values (use hand-calculated examples) |
| `PerformanceTracker` | Equity curve building, daily returns extraction |
| `BotStateMachine` | Valid/invalid state transitions |
| Each Strategy | Against known market data with expected signals |
| Each Indicator | Against known values (compare with reference implementations) |

### Integration Tests

- Full backtest run with a simple strategy on fixture data — verify final equity, trade count, and metrics.
- Bot lifecycle: create → start → receive candles → place orders → stop → verify state saved.

### Test Data Fixtures

Create known test datasets:
- Trending upward (100 candles)
- Trending downward (100 candles)
- Sideways/ranging (100 candles)
- V-shaped recovery
- Flash crash scenario
- Low volume periods

These fixtures ensure consistent, reproducible test results.

---

## 13. Indicators Package Testing

Each indicator must be tested against **known reference values**. Sources for reference:

- Investopedia examples
- TradingView manual calculations
- Python `ta` library outputs (generate expected values, commit as fixtures)

Example approach:
```
Given: closes = [44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84]
When: SMA(period=5) is calculated
Then: result = [44.24, 44.39, 44.66, 44.90, 45.04]
```

---

## 14. Reference Projects

These open-source projects can serve as architectural references (not for copying code):

- **Freqtrade** (Python) — Well-designed bot architecture with strategy interface, backtesting, live trading. Study its strategy interface and risk management patterns.
- **CCXT** examples — Good patterns for exchange API integration.
- **Backtrader** (Python) — Mature backtesting engine. Study its event-driven architecture.

---

## 15. Dependencies to Install

```bash
# @tb/trading-core
ccxt
zod
simple-statistics
ioredis          # For publishing events to Redis from workers
pino             # Logging

# @tb/indicators
tulind           # Native C bindings for fast indicator calculation
# Note: tulind requires C++ build tools (build-essential on Linux)
# Fallback: pure TypeScript implementations for all indicators

# Testing
vitest
```
