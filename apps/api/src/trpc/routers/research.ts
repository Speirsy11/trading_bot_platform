import { researchResults, researchSweeps, type Database } from "@tb/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { RESEARCH_JOB_NAMES } from "../../queues/types";
import {
  buildResearchCandidates,
  RESEARCH_EXECUTION_ASSUMPTIONS,
  normalizeResearchSymbol,
  RESEARCH_ENGINE_VERSION,
  RESEARCH_STRATEGY_KEYS,
  RESEARCH_SYMBOLS,
  RESEARCH_TIMEFRAMES,
  uniqueStrings,
} from "../../services/researchEngine";
import {
  buildReadinessErrorMessage,
  summarizeResearchDataReadiness,
} from "../../services/researchReadiness";
import { toNumber } from "../../utils/serialization";
import { uuidSchema } from "../schemas";
import { createTrpcRouter, protectedProcedure, publicProcedure } from "../trpc";

const researchSweepInputSchema = z
  .object({
    name: z.string().min(1).max(120).default("Top 10 spot research sweep"),
    exchange: z.string().min(1).default("binance"),
    symbols: z
      .array(z.string().min(1).transform(normalizeResearchSymbol))
      .min(1)
      .max(20)
      .transform(uniqueStrings)
      .default([...RESEARCH_SYMBOLS]),
    timeframes: z
      .array(z.enum(RESEARCH_TIMEFRAMES))
      .min(1)
      .max(6)
      .transform(uniqueStrings)
      .default([...RESEARCH_TIMEFRAMES]),
    strategyKeys: z
      .array(z.enum(RESEARCH_STRATEGY_KEYS))
      .min(1)
      .max(10)
      .transform(uniqueStrings)
      .default([...RESEARCH_STRATEGY_KEYS]),
    allowFallbackRollups: z.boolean().default(false),
  })
  .default({});

const evidenceStatusSchema = z
  .enum(["all", "historically-profitable", "alpha-qualified", "benchmark-beater", "unqualified"])
  .default("all");

export type ResearchEvidenceStatus = z.infer<typeof evidenceStatusSchema>;

const researchLeaderboardInputSchema = z
  .object({
    sweepId: uuidSchema.optional(),
    limit: z.number().int().min(1).max(100).default(50),
    qualifiedOnly: z.boolean().default(false),
    evidenceStatus: evidenceStatusSchema,
    strategyKeys: z.array(z.string().min(1)).min(1).max(10).optional(),
    timeframes: z.array(z.string().min(1)).min(1).max(6).optional(),
  })
  .default({});

type ResearchLeaderboardInput = z.infer<typeof researchLeaderboardInputSchema>;

type LeaderboardFilterInput = Pick<
  ResearchLeaderboardInput,
  "evidenceStatus" | "qualifiedOnly" | "strategyKeys" | "timeframes"
>;

export type LeaderboardFilterPlan = {
  requiresQualified: boolean;
  requiresUnqualified: boolean;
  requiresBenchmarkBeat: boolean;
  strategyKeys: string[];
  timeframes: string[];
};

export const researchRouter = createTrpcRouter({
  getDataReadiness: publicProcedure
    .input(
      z
        .object({
          exchange: z.string().min(1).default("binance"),
          symbols: z
            .array(z.string().min(1).transform(normalizeResearchSymbol))
            .min(1)
            .max(20)
            .transform(uniqueStrings)
            .default([...RESEARCH_SYMBOLS]),
          timeframes: z
            .array(z.enum(RESEARCH_TIMEFRAMES))
            .min(1)
            .max(6)
            .transform(uniqueStrings)
            .default([...RESEARCH_TIMEFRAMES]),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const metrics = await ctx.marketData.getQualityMetrics({ exchange: input.exchange });
      return summarizeResearchDataReadiness(metrics, input);
    }),

  runSweep: protectedProcedure.input(researchSweepInputSchema).mutation(async ({ ctx, input }) => {
    if (!input.allowFallbackRollups) {
      const metrics = await ctx.marketData.getQualityMetrics({ exchange: input.exchange });
      const readiness = summarizeResearchDataReadiness(metrics, input);

      if (!readiness.ready) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: buildReadinessErrorMessage(readiness),
          cause: { readiness },
        });
      }
    }

    const candidateCount = buildResearchCandidates(input).length;
    if (candidateCount === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Research sweep produced zero candidate strategies; check strategy keys and timeframes",
      });
    }

    const sweepConfig = {
      ...input,
      engineVersion: RESEARCH_ENGINE_VERSION,
      executionAssumptions: RESEARCH_EXECUTION_ASSUMPTIONS,
    };
    const inserted = await ctx.db
      .insert(researchSweeps)
      .values({
        name: input.name,
        status: "pending",
        config: sweepConfig,
        symbols: input.symbols,
        timeframes: input.timeframes,
        strategyKeys: input.strategyKeys,
      })
      .returning();

    const sweep = inserted[0];
    if (!sweep) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create research sweep",
      });
    }

    const jobId = `research-${sweep.id}`;
    try {
      await ctx.queues.researchQueue.add(
        RESEARCH_JOB_NAMES.RUN_SWEEP,
        { sweepId: sweep.id },
        { jobId, removeOnComplete: false, removeOnFail: false }
      );
    } catch (error) {
      const job = await ctx.queues.researchQueue.getJob(jobId).catch(() => null);
      await job?.remove().catch(() => undefined);
      await ctx.db.delete(researchSweeps).where(eq(researchSweeps.id, sweep.id));
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Failed to enqueue research sweep job",
        cause: error,
      });
    }

    return { sweepId: sweep.id, candidateCount, engineVersion: RESEARCH_ENGINE_VERSION };
  }),

  getSweep: publicProcedure
    .input(z.object({ sweepId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const sweep = await findSweep(ctx.db, input.sweepId);
      const [progress, resultCount] = await Promise.all([
        getSweepProgress(ctx.queues, input.sweepId, sweep.status),
        countSweepResults(ctx.db, input.sweepId),
      ]);

      return {
        ...serializeSweep(sweep),
        progress,
        resultCount,
      };
    }),

  getSweepDetail: publicProcedure
    .input(
      z.object({
        sweepId: uuidSchema,
        limit: z.number().int().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const sweep = await findSweep(ctx.db, input.sweepId);
      const conditions = [eq(researchResults.sweepId, input.sweepId)];
      const [progress, stats, rows] = await Promise.all([
        getSweepProgress(ctx.queues, input.sweepId, sweep.status),
        getLeaderboardStats(ctx.db, input.sweepId),
        ctx.db
          .select()
          .from(researchResults)
          .where(and(...conditions))
          .orderBy(
            desc(researchResults.qualified),
            desc(researchResults.outOfSampleReturn),
            researchResults.maxDrawdown
          )
          .limit(input.limit),
      ]);

      return buildSweepDetailResponse({
        sweep,
        progress,
        resultCount: stats.total,
        stats,
        resultRows: rows,
      });
    }),

  getLeaderboard: publicProcedure
    .input(researchLeaderboardInputSchema)
    .query(async ({ ctx, input }) => {
      const latestSweep = input.sweepId
        ? await findSweep(ctx.db, input.sweepId)
        : await getLatestSweep(ctx.db, RESEARCH_ENGINE_VERSION);
      const latestAnySweep = input.sweepId ? null : await getLatestSweep(ctx.db);
      const latestArchivedSweep =
        !input.sweepId &&
        latestAnySweep &&
        getSweepEngineVersion(latestAnySweep) !== RESEARCH_ENGINE_VERSION
          ? latestAnySweep
          : null;
      const archivedSweepCount = input.sweepId ? 0 : await countArchivedSweeps(ctx.db);
      const sweepId = input.sweepId ?? latestSweep?.id;
      const conditions = sweepId ? buildLeaderboardConditions(sweepId, input) : [];

      const rows = sweepId
        ? await ctx.db
            .select()
            .from(researchResults)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(
              desc(researchResults.qualified),
              desc(researchResults.outOfSampleReturn),
              researchResults.maxDrawdown
            )
            .limit(input.limit)
        : [];
      const stats = sweepId ? await getLeaderboardStats(ctx.db, sweepId) : emptyLeaderboardStats();
      const filteredCount = sweepId ? await countLeaderboardRows(ctx.db, conditions) : 0;

      return {
        currentEngineVersion: RESEARCH_ENGINE_VERSION,
        latestSweep: latestSweep ? serializeSweep(latestSweep) : null,
        latestArchivedSweep: latestArchivedSweep ? serializeSweep(latestArchivedSweep) : null,
        archivedSweepCount,
        stats,
        filteredCount,
        items: rows.map(serializeResultSummary),
      };
    }),

  getResult: publicProcedure
    .input(z.object({ resultId: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(researchResults)
        .where(eq(researchResults.id, input.resultId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Research result not found" });
      const sourceSweep = await findSweep(ctx.db, row.sweepId);
      return serializeResultDetail(row, sourceSweep);
    }),
});

async function getSweepProgress(
  queues: {
    researchQueue: { getJob: (id: string) => Promise<{ progress?: unknown } | null | undefined> };
  },
  sweepId: string,
  status: string
) {
  const job = await queues.researchQueue.getJob(`research-${sweepId}`);
  const jobProgress = job?.progress;
  return typeof jobProgress === "number"
    ? jobProgress
    : status === "completed"
      ? 100
      : status === "running"
        ? 1
        : 0;
}

async function findSweep(db: Database, sweepId: string) {
  const rows = await db
    .select()
    .from(researchSweeps)
    .where(eq(researchSweeps.id, sweepId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Research sweep not found" });
  return row;
}

async function getLatestSweep(db: Database, engineVersion?: string) {
  const rows = await db
    .select()
    .from(researchSweeps)
    .where(
      engineVersion ? sql`${researchSweeps.config}->>'engineVersion' = ${engineVersion}` : undefined
    )
    .orderBy(desc(researchSweeps.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

async function countArchivedSweeps(db: Database) {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(researchSweeps)
    .where(
      sql`COALESCE(${researchSweeps.config}->>'engineVersion', 'legacy') <> ${RESEARCH_ENGINE_VERSION}`
    );
  return Number(rows[0]?.count ?? 0);
}

async function getLeaderboardStats(db: Database, sweepId: string) {
  const rows = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      qualified: sql<number>`COUNT(*) FILTER (WHERE ${researchResults.qualified})::int`,
      benchmarkBeat: sql<number>`COUNT(*) FILTER (WHERE (${researchResults.testMetrics}->>'excessReturn')::numeric > 0)::int`,
      alphaQualified: sql<number>`COUNT(*) FILTER (WHERE ${researchResults.qualified} AND (${researchResults.testMetrics}->>'excessReturn')::numeric > 0)::int`,
    })
    .from(researchResults)
    .where(eq(researchResults.sweepId, sweepId));

  return {
    total: Number(rows[0]?.total ?? 0),
    qualified: Number(rows[0]?.qualified ?? 0),
    benchmarkBeat: Number(rows[0]?.benchmarkBeat ?? 0),
    alphaQualified: Number(rows[0]?.alphaQualified ?? 0),
  };
}

async function countSweepResults(db: Database, sweepId: string) {
  return countLeaderboardRows(db, [eq(researchResults.sweepId, sweepId)]);
}

function buildLeaderboardConditions(sweepId: string, input: ResearchLeaderboardInput): SQL[] {
  const conditions: SQL[] = [eq(researchResults.sweepId, sweepId)];
  const plan = buildLeaderboardFilterPlan(input);

  if (plan.requiresQualified) {
    conditions.push(eq(researchResults.qualified, true));
  }

  if (plan.requiresUnqualified) {
    conditions.push(eq(researchResults.qualified, false));
  }

  if (plan.requiresBenchmarkBeat) {
    conditions.push(benchmarkBeatCondition());
  }

  if (plan.strategyKeys.length) {
    conditions.push(inArray(researchResults.strategy, plan.strategyKeys));
  }

  if (plan.timeframes.length) {
    conditions.push(inArray(researchResults.timeframe, plan.timeframes));
  }

  return conditions;
}

export function buildLeaderboardFilterPlan(input: LeaderboardFilterInput): LeaderboardFilterPlan {
  const evidenceStatus = input.evidenceStatus ?? "all";
  const requiresUnqualified = evidenceStatus === "unqualified";
  const requiresBenchmarkBeat =
    evidenceStatus === "alpha-qualified" || evidenceStatus === "benchmark-beater";
  const requiresQualified =
    !requiresUnqualified &&
    (Boolean(input.qualifiedOnly) ||
      evidenceStatus === "historically-profitable" ||
      evidenceStatus === "alpha-qualified");

  return {
    requiresQualified,
    requiresUnqualified,
    requiresBenchmarkBeat,
    strategyKeys: input.strategyKeys ?? [],
    timeframes: input.timeframes ?? [],
  };
}

function benchmarkBeatCondition() {
  return sql`(${researchResults.testMetrics}->>'excessReturn')::numeric > 0`;
}

async function countLeaderboardRows(db: Database, conditions: SQL[]) {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(researchResults)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return Number(rows[0]?.count ?? 0);
}

function emptyLeaderboardStats() {
  return {
    total: 0,
    qualified: 0,
    benchmarkBeat: 0,
    alphaQualified: 0,
  };
}

export function buildSweepDetailResponse(input: {
  sweep: typeof researchSweeps.$inferSelect;
  progress: number;
  resultCount: number;
  stats: ReturnType<typeof emptyLeaderboardStats>;
  resultRows: Array<typeof researchResults.$inferSelect>;
}) {
  return {
    currentEngineVersion: RESEARCH_ENGINE_VERSION,
    sweep: {
      ...serializeSweep(input.sweep),
      progress: input.progress,
      resultCount: input.resultCount,
    },
    stats: input.stats,
    items: input.resultRows.map(serializeResultSummary),
    topResult: input.resultRows[0] ? serializeResultDetail(input.resultRows[0], input.sweep) : null,
  };
}

function serializeSweep(row: typeof researchSweeps.$inferSelect) {
  return {
    ...row,
    engineVersion: getSweepEngineVersion(row),
    createdAt: row.createdAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function getSweepEngineVersion(row: typeof researchSweeps.$inferSelect) {
  const config = (row.config ?? {}) as Record<string, unknown>;
  return typeof config["engineVersion"] === "string" ? config["engineVersion"] : "legacy";
}

function serializeResultSummary(row: typeof researchResults.$inferSelect) {
  const evidence = summarizeBenchmarkEvidence({
    qualified: row.qualified,
    testMetrics: row.testMetrics,
  });
  return {
    id: row.id,
    sweepId: row.sweepId,
    strategy: row.strategy,
    strategyName: row.strategyName,
    strategyParams: row.strategyParams as Record<string, unknown>,
    paramHash: row.paramHash,
    timeframe: row.timeframe,
    marketMode: row.marketMode,
    qualified: row.qualified,
    qualificationReasons: row.qualificationReasons as string[],
    outOfSampleReturn: toNumber(row.outOfSampleReturn),
    maxDrawdown: toNumber(row.maxDrawdown),
    sharpeRatio: toNumber(row.sharpeRatio),
    profitFactor: toNumber(row.profitFactor),
    winRate: toNumber(row.winRate),
    totalTrades: toNumber(row.totalTrades),
    positiveSymbols: toNumber(row.positiveSymbols),
    testMetrics: row.testMetrics,
    executionAssumptions: getResultExecutionAssumptions(row),
    ...evidence,
    symbols: row.symbols as string[],
    dataCoverage: row.dataCoverage,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}

function serializeResultDetail(
  row: typeof researchResults.$inferSelect,
  sourceSweep?: typeof researchSweeps.$inferSelect
) {
  return {
    ...serializeResultSummary(row),
    sourceSweep: sourceSweep ? serializeSweep(sourceSweep) : null,
    symbols: row.symbols as string[],
    trainMetrics: row.trainMetrics,
    validationMetrics: row.validationMetrics,
    perSymbolResults: row.perSymbolResults,
    portfolioEquityCurve: row.portfolioEquityCurve,
    drawdownCurve: row.drawdownCurve,
    dataCoverage: row.dataCoverage,
  };
}

function getResultExecutionAssumptions(row: typeof researchResults.$inferSelect) {
  const testMetrics = isRecord(row.testMetrics) ? row.testMetrics : {};
  return isRecord(testMetrics["executionAssumptions"])
    ? testMetrics["executionAssumptions"]
    : RESEARCH_EXECUTION_ASSUMPTIONS;
}

export function summarizeBenchmarkEvidence(input: { qualified: boolean; testMetrics: unknown }) {
  const metrics = isRecord(input.testMetrics) ? input.testMetrics : {};
  const benchmark = isRecord(metrics["benchmark"]) ? metrics["benchmark"] : {};
  const benchmarkReturn = numericMetric(benchmark["totalReturn"]);
  const excessReturn = numericMetric(metrics["excessReturn"]);
  const drawdownAdvantage = numericMetric(metrics["drawdownAdvantage"]);
  const benchmarkBeat = excessReturn !== null && excessReturn > 0;
  const alphaQualified = input.qualified && benchmarkBeat;
  return {
    benchmarkReturn,
    excessReturn,
    drawdownAdvantage,
    benchmarkBeat,
    alphaQualified,
    paperBotEligible: input.qualified,
    benchmarkStatus: alphaQualified
      ? "alpha-qualified"
      : input.qualified
        ? "profit-only"
        : benchmarkBeat
          ? "benchmark-beater"
          : "research",
  };
}

function numericMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
