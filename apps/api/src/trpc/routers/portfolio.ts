import { bots, botTrades } from "@tb/db";
import { asc, desc, gte } from "drizzle-orm";
import { z } from "zod";

import { toNumber } from "../../utils/serialization.js";
import { createTrpcRouter, publicProcedure } from "../trpc.js";

const periodSchema = z.object({
  period: z.enum(["1d", "1w", "1m", "3m", "1y", "all"]),
});

export const portfolioRouter = createTrpcRouter({
  getSummary: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(bots);
    const totalValue = rows.reduce((sum, row) => sum + toNumber(row.currentBalance), 0);
    const totalPnl = rows.reduce((sum, row) => sum + toNumber(row.totalPnl), 0);
    const investedCapital = Math.max(totalValue - totalPnl, 0);

    return {
      totalValue,
      totalPnl,
      totalPnlPercent: investedCapital > 0 ? (totalPnl / investedCapital) * 100 : 0,
      botCount: rows.length,
      runningBots: rows.filter((row) => ["running", "starting", "paused"].includes(row.status))
        .length,
    };
  }),

  getPositions: publicProcedure.query(async ({ ctx }) => {
    const trades = await ctx.db.select().from(botTrades).orderBy(desc(botTrades.executedAt));
    const positions = new Map<
      string,
      {
        symbol: string;
        quantity: number;
        grossCost: number;
        realisedPnl: number;
        lastTradeAt: Date | null;
      }
    >();

    for (const trade of trades) {
      const entry = positions.get(trade.symbol) ?? {
        symbol: trade.symbol,
        quantity: 0,
        grossCost: 0,
        realisedPnl: 0,
        lastTradeAt: null,
      };

      const amount = toNumber(trade.amount);
      const direction = trade.side === "buy" ? 1 : -1;
      entry.quantity += amount * direction;
      entry.grossCost += toNumber(trade.cost) * direction;
      entry.realisedPnl += toNumber(trade.pnl);
      if (!entry.lastTradeAt || trade.executedAt > entry.lastTradeAt) {
        entry.lastTradeAt = trade.executedAt;
      }
      positions.set(trade.symbol, entry);
    }

    return [...positions.values()].map((position) => ({
      symbol: position.symbol,
      quantity: position.quantity,
      averagePrice: position.quantity !== 0 ? Math.abs(position.grossCost / position.quantity) : 0,
      realisedPnl: position.realisedPnl,
      lastTradeAt: position.lastTradeAt?.toISOString() ?? null,
    }));
  }),

  getEquityCurve: publicProcedure.input(periodSchema).query(async ({ ctx, input }) => {
    const since = periodToDate(input.period);
    const trades = await ctx.db
      .select()
      .from(botTrades)
      .where(since ? gte(botTrades.executedAt, since) : undefined)
      .orderBy(asc(botTrades.executedAt));

    let equity = 0;
    const curve = trades.map((trade) => {
      equity += toNumber(trade.pnl);
      return {
        time: trade.executedAt.getTime(),
        equity,
      };
    });

    return curve;
  }),

  getAllocation: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(bots);
    const buckets = new Map<string, number>();

    for (const row of rows) {
      buckets.set(row.exchange, (buckets.get(row.exchange) ?? 0) + toNumber(row.currentBalance));
    }

    const total = [...buckets.values()].reduce((sum, value) => sum + value, 0);

    return [...buckets.entries()].map(([exchange, value]) => ({
      exchange,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
    }));
  }),
});

function periodToDate(period: z.infer<typeof periodSchema>["period"]) {
  if (period === "all") {
    return null;
  }

  const now = Date.now();
  const offsets: Record<Exclude<z.infer<typeof periodSchema>["period"], "all">, number> = {
    "1d": 24 * 60 * 60_000,
    "1w": 7 * 24 * 60 * 60_000,
    "1m": 30 * 24 * 60 * 60_000,
    "3m": 90 * 24 * 60 * 60_000,
    "1y": 365 * 24 * 60 * 60_000,
  };

  return new Date(now - offsets[period]);
}
