import type { Candle } from "@tb/types";
import type { z } from "zod";

import type { StrategyContext } from "./StrategyContext.js";

export type SignalAction = "BUY" | "SELL" | "CLOSE_LONG" | "CLOSE_SHORT" | "NEUTRAL";

export interface Signal {
  action: SignalAction;
  symbol: string;
  orderType: "market" | "limit" | "stop" | "stop_limit";
  price?: number;
  amount?: number;
  stopLoss?: number;
  takeProfit?: number;
  reason?: string;
}

export interface IStrategy {
  readonly name: string;
  readonly description: string;
  readonly paramsSchema: z.ZodSchema;
  initialize(ctx: StrategyContext): Promise<void>;
  onCandle(candle: Candle, history: Candle[]): Promise<Signal[]>;
  cleanup(): Promise<void>;
}
