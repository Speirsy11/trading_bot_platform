"use client";

import { trpc } from "@/lib/trpc";

export function useMarketData(
  exchange: string,
  symbol: string,
  timeframe: string,
  options?: { startTime?: number; endTime?: number; limit?: number }
) {
  return trpc.market.getCandles.useQuery({
    exchange,
    symbol,
    timeframe,
    startTime: options?.startTime,
    endTime: options?.endTime,
    limit: options?.limit ?? 500,
  });
}
