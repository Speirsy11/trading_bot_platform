// ─── Core Market Data ────────────────────────────────────────────────────────

export interface Candle {
  time: number; // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradesCount?: number;
}

export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderSide = "buy" | "sell";
export type OrderStatus = "open" | "closed" | "canceled" | "expired";

export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  amount: number;
  price?: number;
  stopPrice?: number;
  filled: number;
  remaining: number;
  cost: number;
  status: OrderStatus;
  timestamp: number;
  fee?: { cost: number; currency: string };
}

export interface Balance {
  total: Record<string, number>;
  free: Record<string, number>;
  used: Record<string, number>;
}

// ─── Signal ──────────────────────────────────────────────────────────────────

export type SignalAction = "buy" | "sell" | "hold";

export interface Signal {
  action: SignalAction;
  confidence: number; // 0-1
  reason?: string;
  amount?: number;
  price?: number;
}

// ─── Exchange Abstraction ────────────────────────────────────────────────────

export interface IExchange {
  fetchOHLCV(
    symbol: string,
    timeframe: string,
    since?: number,
    limit?: number,
  ): Promise<Candle[]>;
  createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
  ): Promise<Order>;
  cancelOrder(id: string, symbol?: string): Promise<void>;
  fetchBalance(): Promise<Balance>;
  fetchOpenOrders(symbol?: string): Promise<Order[]>;
}

// ─── Strategy Contract ───────────────────────────────────────────────────────

export interface StrategyConfig {
  [key: string]: unknown;
}

export interface RiskConfig {
  maxPositionSize: number;
  maxDrawdown: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  maxOpenOrders?: number;
}

export interface IStrategy {
  name: string;
  initialize(exchange: IExchange, config: StrategyConfig): Promise<void>;
  onCandle(candle: Candle, history: Candle[]): Promise<Signal>;
  cleanup(): Promise<void>;
}

// ─── Bot Configuration ───────────────────────────────────────────────────────

export type BotMode = "backtest" | "paper" | "live";
export type BotStatus = "idle" | "running" | "stopped" | "error";

export interface BotConfig {
  id: string;
  name: string;
  strategy: string;
  strategyParams: Record<string, unknown>;
  exchange: string;
  symbol: string;
  timeframe: string;
  mode: BotMode;
  riskConfig: RiskConfig;
}

// ─── Data Pipeline Types ─────────────────────────────────────────────────────

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type ExchangeId = "binance" | "kraken" | "kucoin" | "bybit" | "coinbase";

export type CollectionStatus = "idle" | "collecting" | "backfilling" | "error";

export type ExportFormat = "csv" | "parquet" | "sqlite";

export type ExportStatus = "pending" | "processing" | "completed" | "failed";

export interface OHLCVRecord {
  time: Date;
  exchange: string;
  symbol: string;
  timeframe: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradesCount: number | null;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  rule: string;
  message: string;
  severity: ValidationSeverity;
  candle?: Candle;
}
