import { orderAuditLog } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { mapExchangeError } from "../../utils/errors";
import { orderPlacedCounter } from "../../utils/metrics";
import { checkNotionalCap } from "../../utils/notionalCap";
import { createTrpcRouter, protectedProcedure } from "../trpc";

export const tradingRouter = createTrpcRouter({
  placeOrder: protectedProcedure
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

      if (process.env["APP_MODE"] !== "testing" && process.env["TRADING_ENABLED"] !== "true") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Live trading is disabled in this environment.",
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
          status: process.env["APP_MODE"] === "testing" ? "simulated" : "placed",
          source: "manual",
          requestedAt: new Date(),
        })
        .returning();

      if (process.env["APP_MODE"] === "testing") {
        const result = {
          id: `testing-order-${Date.now()}`,
          symbol,
          type,
          side,
          amount,
          price: price ?? null,
          status: "closed",
          filled: amount,
          remaining: 0,
          cost: amount * (price ?? 0),
          timestamp: Date.now(),
          simulated: true,
        };

        if (auditRecord) {
          await ctx.db
            .update(orderAuditLog)
            .set({ orderId: result.id, settledAt: new Date() })
            .where(eq(orderAuditLog.id, auditRecord.id));
        }

        return result;
      }

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

  cancelOrder: protectedProcedure
    .input(
      z.object({
        exchange: z.string(),
        symbol: z.string(),
        orderId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { exchange, symbol, orderId } = input;

      if (process.env["APP_MODE"] !== "testing" && process.env["TRADING_ENABLED"] !== "true") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Live trading is disabled in this environment.",
        });
      }

      await ctx.db.insert(orderAuditLog).values({
        exchangeId: exchange,
        symbol,
        orderId,
        status: "cancelled",
        source: "manual",
        requestedAt: new Date(),
      });

      if (process.env["APP_MODE"] === "testing") {
        return { success: true, orderId, symbol, simulated: true };
      }

      try {
        return await ctx.exchangeManager.cancelOrder(exchange, symbol, orderId);
      } catch (error) {
        throw mapExchangeError(error);
      }
    }),
});
