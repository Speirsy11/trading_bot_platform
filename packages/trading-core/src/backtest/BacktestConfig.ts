import type { RiskConfig } from "../risk/RiskManager.js";

export interface BacktestConfig {
  strategyName: string;
  strategyParams: Record<string, unknown>;
  exchange: string;
  symbol: string;
  timeframe: string;
  startDate: number;
  endDate: number;
  initialBalance: number;
  fees: {
    maker: number;
    taker: number;
  };
  slippage: {
    enabled: boolean;
    percentage: number;
  };
  riskConfig: RiskConfig;
  historyWindowSize?: number;
}
