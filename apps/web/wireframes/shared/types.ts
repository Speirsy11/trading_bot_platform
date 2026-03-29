export type Status = "running" | "stopped" | "paused" | "error";
export type Side = "buy" | "sell";
export type OrderType = "market" | "limit";

export interface Allocation {
  symbol: string;
  weight: number;
  value: number;
}

export interface PortfolioSummary {
  totalValue: number;
  dailyChangePct: number;
  totalPnl: number;
  cashBalance: number;
  allocations: Allocation[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Bot {
  id: string;
  name: string;
  exchange: string;
  pair: string;
  strategy: string;
  status: Status;
  pnl: number;
  pnlPct: number;
  mode: "paper" | "live";
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
}

export interface Trade {
  id: string;
  timestamp: string;
  symbol: string;
  side: Side;
  price: number;
  amount: number;
  fee: number;
}

export interface OpenOrder {
  id: string;
  symbol: string;
  side: Side;
  type: OrderType;
  price: number;
  amount: number;
  status: "pending" | "partial";
}

export interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
}

export interface BotMetrics {
  sharpe: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  totalReturn: number;
}

export interface ThemeMeta {
  id: string;
  name: string;
  rationale: string;
}
