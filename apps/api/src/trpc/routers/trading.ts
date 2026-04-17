import { orderAuditLog } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { mapExchangeError } from "../../utils/errors";
import { orderPlacedCounter } from "../../utils/metrics";
import { checkNotionalCap } from "../../utils/notionalCap";
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

      try {
        checkNotionalCap(amount, price, type);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : String(e),
        });
      }

      const [auditRecord] = await ctx.db
        .insert(orderAuditLog)
        .values({
          exchangeId: exchange,
          symbol,
          side,
          type,
          amount: amount.toString(),
          price: price != null ? price.toString() : null,
          status: "placed",
          source: "manual",
          requestedAt: new Date(),
        })
        .returning();

      try {
        const result = await ctx.exchangeManager.createOrder(
          exchange,
          symbol,
          type,
          side,
          amount,
          price
        );
        orderPlacedCounter.inc({ exchange, side, type });

        if (auditRecord) {
          await ctx.db
            .update(orderAuditLog)
            .set({ orderId: result.id, settledAt: new Date() })
            .where(eq(orderAuditLog.id, auditRecord.id));
        }

        return result;
      } catch (error) {
        if (auditRecord) {
          await ctx.db
            .update(orderAuditLog)
            .set({
              status: "failed",
              errorMessage: error instanceof Error ? error.message : String(error),
            })
            .where(eq(orderAuditLog.id, auditRecord.id));
        }

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

      await ctx.db.insert(orderAuditLog).values({
        exchangeId: exchange,
        symbol,
        orderId,
        status: "cancelled",
        source: "manual",
        requestedAt: new Date(),
      });

      try {
        return await ctx.exchangeManager.cancelOrder(exchange, symbol, orderId);
      } catch (error) {
        throw mapExchangeError(error);
      }
    }),
});
