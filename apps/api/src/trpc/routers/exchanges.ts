import { exchangeConfigs } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { parseJsonValue, stringifyJsonValue } from "../../utils/serialization.js";
import { exchangeCreateSchema, uuidSchema } from "../schemas.js";
import { createTrpcRouter, publicProcedure } from "../trpc.js";

export const exchangesRouter = createTrpcRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(exchangeConfigs)
      .orderBy(desc(exchangeConfigs.createdAt));
    return rows.map((row) => serializeExchange(row));
  }),

  add: publicProcedure.input(exchangeCreateSchema).mutation(async ({ ctx, input }) => {
    try {
      const inserted = await ctx.db
        .insert(exchangeConfigs)
        .values({
          exchange: input.exchange,
          apiKey: ctx.keyVault.encrypt(input.apiKey),
          apiSecret: ctx.keyVault.encrypt(input.apiSecret),
          passphrase: input.passphrase ? ctx.keyVault.encrypt(input.passphrase) : null,
          sandbox: input.testnet,
          metadata: stringifyJsonValue({ name: input.name }),
        })
        .returning();

      const row = inserted[0];
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create exchange config",
        });
      }

      return serializeExchange(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Exchange ${input.exchange} is already configured`,
        });
      }

      throw error;
    }
  }),

  testConnection: publicProcedure
    .input(z.object({ exchangeId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      return ctx.exchangeManager.testConnection(input.exchangeId);
    }),

  remove: publicProcedure
    .input(z.object({ exchangeId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(exchangeConfigs).where(eq(exchangeConfigs.id, input.exchangeId));
      ctx.exchangeManager.clearCache(input.exchangeId);
      return { success: true };
    }),

  update: publicProcedure
    .input(z.object({ exchangeId: uuidSchema, name: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(exchangeConfigs)
        .where(eq(exchangeConfigs.id, input.exchangeId))
        .limit(1);
      const row = existing[0];
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exchange config not found" });
      }

      const metadata = parseJsonValue<Record<string, unknown>>(row.metadata, {});
      const updated = await ctx.db
        .update(exchangeConfigs)
        .set({
          metadata: stringifyJsonValue({ ...metadata, name: input.name ?? metadata["name"] }),
          updatedAt: new Date(),
        })
        .where(eq(exchangeConfigs.id, input.exchangeId))
        .returning();

      if (updated.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exchange config not found" });
      }

      ctx.exchangeManager.clearCache(input.exchangeId);
      return serializeExchange(updated[0]!);
    }),
});

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function serializeExchange(row: typeof exchangeConfigs.$inferSelect) {
  const metadata = parseJsonValue<Record<string, unknown>>(row.metadata, {});
  return {
    id: row.id,
    exchange: row.exchange,
    name: typeof metadata["name"] === "string" ? metadata["name"] : row.exchange,
    enabled: row.enabled ?? true,
    testnet: row.sandbox ?? false,
    hasCredentials: Boolean(row.apiKey && row.apiSecret),
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}
