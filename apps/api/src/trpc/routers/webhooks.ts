import { webhooks } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { deliverWebhook } from "../../services/webhookDelivery";
import { uuidSchema } from "../schemas";
import { createTrpcRouter, protectedProcedure } from "../trpc";

export const webhooksRouter = createTrpcRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(webhooks);
  }),

  create: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        events: z.array(z.string().min(1)).min(1),
        secret: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(webhooks)
        .values({
          url: input.url,
          events: input.events,
          secret: input.secret ?? null,
        })
        .returning();

      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create webhook" });
      }

      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(webhooks)
        .where(eq(webhooks.id, input.id))
        .returning({ id: webhooks.id });

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      return { success: true };
    }),

  test: protectedProcedure.input(z.object({ id: uuidSchema })).mutation(async ({ ctx, input }) => {
    const [webhook] = await ctx.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, input.id))
      .limit(1);

    if (!webhook) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
    }

    await deliverWebhook(ctx.db, "webhook.test", { webhookId: webhook.id });

    return { success: true };
  }),
});
