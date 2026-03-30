import { unlink } from "node:fs/promises";
import { basename } from "node:path";

import { dataExports, type Database } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { desc, eq, lt } from "drizzle-orm";
import { z } from "zod";

import { dataExportSchema, uuidSchema } from "../schemas.js";
import { createTrpcRouter, publicProcedure } from "../trpc.js";

export const dataExportRouter = createTrpcRouter({
  create: publicProcedure.input(dataExportSchema).mutation(async ({ ctx, input }) => {
    const inserted = await ctx.db
      .insert(dataExports)
      .values({
        exchange: input.exchange,
        symbols: input.symbols,
        timeframe: input.timeframe,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        format: input.format,
        compressed: input.compress,
        status: "pending",
        progress: 0,
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `dataExport.create did not return an inserted row (received ${JSON.stringify(inserted)})`,
      });
    }

    await ctx.queues.dataExportQueue.add(
      "export-data",
      {
        exportId: row.id,
        exchange: row.exchange,
        symbols: row.symbols,
        timeframe: row.timeframe,
        startTime: row.startTime.toISOString(),
        endTime: row.endTime.toISOString(),
        format: row.format,
        compressed: row.compressed ?? true,
        outputDir: ctx.exportsDir,
      },
      { jobId: `export-${row.id}`, removeOnComplete: false, removeOnFail: false }
    );

    return { exportId: row.id };
  }),

  getStatus: publicProcedure
    .input(z.object({ exportId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const row = await findExport(ctx.db, input.exportId);
      return {
        status: row.status,
        progress: row.progress ?? 0,
        downloadUrl: row.filePath ? `/exports/${basename(row.filePath)}` : null,
        error: row.error,
      };
    }),

  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(dataExports)
        .where(input.cursor ? lt(dataExports.createdAt, new Date(input.cursor)) : undefined)
        .orderBy(desc(dataExports.createdAt))
        .limit(input.limit + 1);

      const hasNextPage = rows.length > input.limit;
      const pageRows = hasNextPage ? rows.slice(0, input.limit) : rows;
      const lastRow = pageRows.at(-1);
      const nextCursor = hasNextPage && lastRow?.createdAt ? lastRow.createdAt.toISOString() : null;

      return {
        items: pageRows.map((row) => ({
          ...row,
          startTime: row.startTime.toISOString(),
          endTime: row.endTime.toISOString(),
          createdAt: row.createdAt?.toISOString() ?? null,
          completedAt: row.completedAt?.toISOString() ?? null,
          downloadUrl: row.filePath ? `/exports/${basename(row.filePath)}` : null,
        })),
        nextCursor,
      };
    }),

  delete: publicProcedure
    .input(z.object({ exportId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const row = await findExport(ctx.db, input.exportId);
      if (row.filePath) {
        await unlink(row.filePath).catch(() => undefined);
      }
      await ctx.db.delete(dataExports).where(eq(dataExports.id, input.exportId));
      return { success: true };
    }),
});

async function findExport(db: Database, exportId: string) {
  const rows = await db.select().from(dataExports).where(eq(dataExports.id, exportId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Export not found" });
  }
  return row;
}
