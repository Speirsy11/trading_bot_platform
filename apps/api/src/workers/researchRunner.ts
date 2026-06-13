import { researchResults, researchSweeps, type Database } from "@tb/db";
import { Worker } from "bullmq";
import { desc, eq } from "drizzle-orm";
import type IORedis from "ioredis";

import { API_QUEUE_NAMES, RESEARCH_JOB_NAMES, type ResearchJobData } from "../queues/types";
import type { MarketDataReader } from "../services/harvesterMarketData";
import {
  buildResearchCandidateResult,
  buildResearchCandidates,
  loadResearchSymbolDataset,
  RESEARCH_EXECUTION_ASSUMPTIONS,
  resolveResearchSymbols,
  runResearchCandidateOnSymbolDataset,
  type AggregateMetrics,
  type ResearchCandidateResult,
  type ResearchSymbolSplitResult,
  type ResearchSweepOptions,
} from "../services/researchEngine";
import { assertNativeResearchRollupsReady } from "../services/researchReadiness";
import { bootstrapStrategies } from "../services/strategyCatalog";

export function createResearchWorker(options: {
  db: Database;
  redis: IORedis;
  marketData: MarketDataReader;
}) {
  bootstrapStrategies();

  return new Worker<ResearchJobData>(
    API_QUEUE_NAMES.RESEARCH,
    async (job) => {
      if (job.name !== RESEARCH_JOB_NAMES.RUN_SWEEP) return null;
      return runResearchSweepJob(options, job.data.sweepId, {
        updateProgress: (progress) => job.updateProgress(progress),
      });
    },
    {
      connection: options.redis.duplicate({ maxRetriesPerRequest: null }),
      concurrency: 1,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 20 },
    }
  );
}

export async function runResearchSweepJob(
  options: {
    db: Database;
    redis: IORedis;
    marketData: MarketDataReader;
  },
  sweepId: string,
  progressSink: { updateProgress?: (progress: number) => Promise<unknown> } = {}
) {
  bootstrapStrategies();

  const sweep = (
    await options.db.select().from(researchSweeps).where(eq(researchSweeps.id, sweepId)).limit(1)
  )[0];
  if (!sweep) throw new Error(`Research sweep ${sweepId} not found`);

  const config = (sweep.config ?? {}) as ResearchSweepOptions;
  const candidates = buildResearchCandidates(config);

  await options.db
    .update(researchSweeps)
    .set({ status: "running", startedAt: new Date(), error: null })
    .where(eq(researchSweeps.id, sweep.id));
  await options.db.delete(researchResults).where(eq(researchResults.sweepId, sweep.id));

  let completed = 0;
  try {
    if (candidates.length === 0) {
      throw new Error(
        "Research sweep produced zero candidate strategies; check strategy keys and timeframes"
      );
    }

    await assertNativeResearchRollupsReady(options.marketData, config);

    for (const [timeframe, timeframeCandidates] of groupCandidatesByTimeframe(candidates)) {
      const symbolResultsByCandidate = new Map<
        (typeof timeframeCandidates)[number],
        ResearchSymbolSplitResult[]
      >();
      for (const candidate of timeframeCandidates) {
        symbolResultsByCandidate.set(candidate, []);
      }

      const symbols = resolveResearchSymbols(config);
      for (let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex++) {
        const symbol = symbols[symbolIndex]!;
        await publishProgress(options.redis, sweep.id, {
          progress: Math.round((completed / candidates.length) * 100),
          completed,
          total: candidates.length,
          timeframe,
          symbol,
          symbolIndex: symbolIndex + 1,
          symbolCount: symbols.length,
          stage: "loading-symbol-data",
        });

        const symbolDataset = await loadResearchSymbolDataset(
          options.marketData,
          timeframe,
          config,
          symbol
        );

        for (const candidate of timeframeCandidates) {
          const symbolResult = await runResearchCandidateOnSymbolDataset(
            candidate,
            config.exchange ?? "binance",
            timeframe,
            symbolDataset
          );
          symbolResultsByCandidate.get(candidate)?.push(symbolResult);
        }
      }

      for (const candidate of timeframeCandidates) {
        const result = buildResearchCandidateResult(
          candidate,
          symbolResultsByCandidate.get(candidate) ?? []
        );
        await persistResearchResult(options.db, sweep.id, result);
        completed++;
        const progress = Math.round((completed / candidates.length) * 100);
        await progressSink.updateProgress?.(progress).catch(() => undefined);
        await publishProgress(options.redis, sweep.id, {
          progress,
          completed,
          total: candidates.length,
          timeframe,
          stage: "persisting-candidates",
        });
      }
    }

    const best = (
      await options.db
        .select({ id: researchResults.id })
        .from(researchResults)
        .where(eq(researchResults.sweepId, sweep.id))
        .orderBy(
          desc(researchResults.qualified),
          desc(researchResults.outOfSampleReturn),
          researchResults.maxDrawdown
        )
        .limit(1)
    )[0];

    await options.db
      .update(researchSweeps)
      .set({
        status: "completed",
        bestResultId: best?.id ?? null,
        completedAt: new Date(),
      })
      .where(eq(researchSweeps.id, sweep.id));

    return { sweepId: sweep.id, status: "completed", candidates: candidates.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await options.db
      .update(researchSweeps)
      .set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(researchSweeps.id, sweep.id));
    await options.redis
      .publish(
        "worker:error",
        JSON.stringify({
          scope: "research",
          sweepId: sweep.id,
          message,
          timestamp: Date.now(),
        })
      )
      .catch(() => undefined);
    throw error;
  }
}

function groupCandidatesByTimeframe(candidates: ReturnType<typeof buildResearchCandidates>) {
  const grouped = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const existing = grouped.get(candidate.timeframe) ?? [];
    existing.push(candidate);
    grouped.set(candidate.timeframe, existing);
  }
  return grouped;
}

async function publishProgress(
  redis: IORedis,
  sweepId: string,
  progress: {
    progress: number;
    completed: number;
    total: number;
    timeframe: string;
    symbol?: string;
    symbolIndex?: number;
    symbolCount?: number;
    stage: string;
  }
) {
  await redis
    .publish(
      "research:progress",
      JSON.stringify({
        sweepId,
        ...progress,
        timestamp: Date.now(),
      })
    )
    .catch(() => undefined);
}

async function persistResearchResult(
  db: Database,
  sweepId: string,
  result: ResearchCandidateResult
) {
  await db.insert(researchResults).values({
    sweepId,
    strategy: result.candidate.strategy,
    strategyName: result.candidate.strategyName,
    strategyParams: result.candidate.strategyParams,
    paramHash: result.candidate.paramHash,
    timeframe: result.candidate.timeframe,
    marketMode: RESEARCH_EXECUTION_ASSUMPTIONS.marketMode,
    symbols: result.symbols.map((row) => row.symbol),
    trainMetrics: withExecutionAssumptions(result.trainMetrics),
    validationMetrics: withExecutionAssumptions(result.validationMetrics),
    testMetrics: withExecutionAssumptions(result.testMetrics),
    perSymbolResults: result.symbols,
    portfolioEquityCurve: result.portfolioEquityCurve,
    drawdownCurve: result.drawdownCurve,
    dataCoverage: result.symbols.map((row) => ({
      symbol: row.symbol,
      ...row.coverage,
    })),
    qualified: result.qualified,
    qualificationReasons: result.qualificationReasons,
    outOfSampleReturn: result.testMetrics.totalReturn.toString(),
    maxDrawdown: result.testMetrics.maxDrawdown.toString(),
    sharpeRatio: result.testMetrics.sharpeRatio.toString(),
    profitFactor: result.testMetrics.profitFactor.toString(),
    winRate: result.testMetrics.winRate.toString(),
    totalTrades: result.testMetrics.totalTrades.toString(),
    positiveSymbols: result.testMetrics.positiveSymbols.toString(),
  });
}

function withExecutionAssumptions(metrics: AggregateMetrics) {
  return {
    ...metrics,
    executionAssumptions: RESEARCH_EXECUTION_ASSUMPTIONS,
  };
}
