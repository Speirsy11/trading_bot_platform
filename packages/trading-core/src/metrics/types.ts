import type { TradeRecord } from "../exchange/types";

export interface EquityPoint {
  time: number;
  equity: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  cagr: number;
  netProfit: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  riskRewardRatio: number;
  expectancy: number;
  totalTrades: number;
  avgHoldTime: number;
  maxWinStreak: number;
  maxLossStreak: number;
}

export interface BacktestResult {
  strategyName: string;
  symbol: string;
  timeframe: string;
  startDate: number;
  endDate: number;
  initialBalance: number;
  finalBalance: number;
  metrics: PerformanceMetrics;
  trades: TradeRecord[];
  equityCurve: EquityPoint[];
  drawdownCurve: EquityPoint[];
}
