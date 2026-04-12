import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { mapExchangeError } from "../../utils/errors";
import { createTrpcRouter, publicProcedure } from "../trpc";

export const tradingRouter = createTrpcRouter({
  placeOrder: publicProcedure
    .input(
      z.object({
        exchange: z.string(),
        symbol: z.string(),
        side: z.enum(["buy", "sell"]),
        type: z.enum(["market", "limit"]),
        amount: z.number().positive(),
        price: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { exchange, symbol, side, type, amount, price } = input;

      if (type === "limit" && price == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Price is required for limit orders",
        });
      }

      const maxNotional = Number(process.env["MAX_NOTIONAL_USD"] ?? 10000);
      if (type === "limit" && price != null && amount * price > maxNotional) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order exceeds max notional",
        });
      }

      try {
        return await ctx.exchangeManager.createOrder(exchange, symbol, type, side, amount, price);
      } catch (error) {
        throw mapExchangeError(error);
      }
    }),

  cancelOrder: publicProcedure
    .input(
      z.object({
        exchange: z.string(),
        symbol: z.string(),
        orderId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { exchange, symbol, orderId } = input;

      try {
        return await ctx.exchangeManager.cancelOrder(exchange, symbol, orderId);
      } catch (error) {
        throw mapExchangeError(error);
      }
    }),
});
