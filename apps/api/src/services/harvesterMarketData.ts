import type { Database } from "@tb/db";
import { ohlcv, queryOHLCVByRange } from "@tb/db";
import { timeframeToMs } from "@tb/trading-core";
import { and, asc, desc, eq, gt, gte, lte, sql as drizzleSql } from "drizzle-orm";
import postgres, { type Sql } from "postgres";

export type MarketCandle = {
  exchange: string;
  symbol: string;
  timeframe: string;
  time: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradesCount?: number | null;
};

export type MarketCoverage = {
  earliest: Date | null;
  latest: Date | null;
  totalCandles: number;
  gapCount: number;
};

export type MarketQualityMetric = {
  exchange: string;
  symbol: string;
  timeframe: string;
  totalCandles: number;
  gapCount: number;
  earliest: string | null;
  latest: string | null;
  startTime: string | null;
  nextStartTime: string | null;
  latestAvailableTime: string | null;
  latestCandleAgeMs: number | null;
  websocketStatus: string;
  restFallbackCount: number;
  validationFailures: number;
  apiErrors: number;
  repairFailures: number;
  backfillBacklog: number;
  candlesInserted: number;
  missingCandles: number;
  completenessPct: string;
  lastUpdated: string | null;
  status: string;
};

export type MarketCandleStreamParams = {
  exchange: string;
  symbol: string;
  timeframe: string;
  startTime: Date;
  endTime: Date;
};

export interface MarketDataReader {
  getLatestCandle(
    exchange: string,
    symbol: string,
    timeframe?: string
  ): Promise<MarketCandle | null>;
  getCandles(params: {
    exchange: string;
    symbol: string;
    timeframe: string;
    startTime?: Date;
    endTime?: Date;
    limit: number;
  }): Promise<MarketCandle[]>;
  streamCandles(
    params: MarketCandleStreamParams,
    batchSize?: number
  ): AsyncIterable<MarketCandle[]>;
  getSymbols(exchange: string): Promise<string[]>;
  getCoverage(exchange: string, symbol: string, timeframe: string): Promise<MarketCoverage>;
  getQualityMetrics(input?: { exchange?: string; symbol?: string }): Promise<MarketQualityMetric[]>;
  close?: () => Promise<void>;
}

export function createHarvesterMarketDataReader(databaseUrl: string): MarketDataReader {
  return new HarvesterPostgresMarketDataReader(postgres(databaseUrl, { max: 8 }));
}

export function createHarvesterMarketDataReaderFromSql(sql: Sql): MarketDataReader {
  return new HarvesterPostgresMarketDataReader(sql);
}

export function createLocalMarketDataReader(db: Database): MarketDataReader {
  return new LocalDrizzleMarketDataReader(db);
}

export function createCanonicalMarketDataReader(options: {
  db: Database;
  harvesterDatabaseUrl?: string;
  env?: NodeJS.ProcessEnv;
}): MarketDataReader {
  const harvesterDatabaseUrl = options.harvesterDatabaseUrl?.trim();
  if (harvesterDatabaseUrl) {
    return createHarvesterMarketDataReader(harvesterDatabaseUrl);
  }

  if (allowLocalMarketDataFallback(options.env)) {
    return createLocalMarketDataReader(options.db);
  }

  throw new Error(
    "SIGNAL_HARVESTER_DATABASE_URL must be set for canonical market data. " +
      "Set MARKET_DATA_ALLOW_LOCAL_FALLBACK=true only for local tests or development fixtures."
  );
}

export function allowLocalMarketDataFallback(env: NodeJS.ProcessEnv = process.env) {
  return (
    env["MARKET_DATA_ALLOW_LOCAL_FALLBACK"] === "true" ||
    env["APP_MODE"] === "testing" ||
    env["NODE_ENV"] === "test"
  );
}

class HarvesterPostgresMarketDataReader implements MarketDataReader {
  constructor(private readonly sql: Sql) {}

  async getLatestCandle(
    exchange: string,
    symbol: string,
    timeframe = "1m"
  ): Promise<MarketCandle | null> {
    const rows = await this.sql<HarvesterCandleRow[]>`
      SELECT provider, symbol, interval, timestamp, open, high, low, close, volume
      FROM market_data_points
      WHERE provider = ${toHarvesterProvider(exchange)}
        AND symbol = ${toHarvesterSymbol(symbol)}
        AND interval = ${toHarvesterInterval(timeframe)}
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    if (rows[0]) return mapHarvesterCandle(rows[0], exchange, symbol, timeframe);

    if (timeframe === "1m") return null;

    const oneMinuteLatest = await this.getLatestCandle(exchange, symbol, "1m");
    if (!oneMinuteLatest) return null;

    const bucketMs = timeframeToMs(timeframe);
    const bucketStart = new Date(Math.floor(oneMinuteLatest.time.getTime() / bucketMs) * bucketMs);
    let latest: MarketCandle | null = null;
    for await (const batch of this.streamRollupCandles(
      {
        exchange,
        symbol,
        timeframe,
        startTime: bucketStart,
        endTime: oneMinuteLatest.time,
      },
      1
    )) {
      latest = batch.at(-1) ?? latest;
    }
    return latest;
  }

  async getCandles(params: {
    exchange: string;
    symbol: string;
    timeframe: string;
    startTime?: Date;
    endTime?: Date;
    limit: number;
  }) {
    const endTime =
      params.endTime ??
      (await this.getLatestCandle(params.exchange, params.symbol, params.timeframe))?.time;
    if (!endTime) return [];
    const startTime =
      params.startTime ??
      new Date(endTime.getTime() - timeframeToMs(params.timeframe) * (params.limit + 1));

    const candles: MarketCandle[] = [];
    for await (const batch of this.streamCandles(
      { ...params, startTime, endTime },
      Math.max(params.limit, 1000)
    )) {
      candles.push(...batch);
      if (candles.length > params.limit * 2) {
        candles.splice(0, candles.length - params.limit * 2);
      }
    }

    return candles.slice(-params.limit);
  }

  async *streamCandles(
    params: MarketCandleStreamParams,
    batchSize: number = 10_000
  ): AsyncIterable<MarketCandle[]> {
    if (params.timeframe === "1m") {
      yield* this.streamNativeIntervalCandles(params, batchSize);
      return;
    }

    const nativeCoverage = await this.getNativeCoverage(
      params.exchange,
      params.symbol,
      params.timeframe
    );
    if (nativeCoversRange(nativeCoverage, params)) {
      yield* this.streamNativeIntervalCandles(params, batchSize);
      return;
    }

    yield* this.streamRollupCandles(params, batchSize);
  }

  async getSymbols(exchange: string) {
    const rows = await this.sql<{ symbol: string }[]>`
      SELECT DISTINCT symbol
      FROM market_data_backfills
      WHERE provider = ${toHarvesterProvider(exchange)}
      ORDER BY symbol
    `;
    return rows.map((row) => fromHarvesterSymbol(row.symbol));
  }

  async getCoverage(exchange: string, symbol: string, timeframe: string): Promise<MarketCoverage> {
    if (timeframe !== "1m") {
      const native = await this.getNativeCoverage(exchange, symbol, timeframe);
      if (native.earliest && native.latest && native.totalCandles > 0) {
        return native;
      }

      const oneMinute = await this.getCoverage(exchange, symbol, "1m");
      if (!oneMinute.earliest || !oneMinute.latest) return oneMinute;

      if (
        nativeCoversRange(native, {
          exchange,
          symbol,
          timeframe,
          startTime: oneMinute.earliest,
          endTime: oneMinute.latest,
        })
      ) {
        return native;
      }

      const bucketMs = timeframeToMs(timeframe);
      const expected = Math.max(
        Math.floor((oneMinute.latest.getTime() - oneMinute.earliest.getTime()) / bucketMs) + 1,
        0
      );
      return { ...oneMinute, totalCandles: expected };
    }

    const rows = await this.sql<
      { earliest: Date | null; latest: Date | null; total_candles: string | number | null }[]
    >`
      SELECT
        MIN(timestamp) AS earliest,
        MAX(timestamp) AS latest,
        COUNT(*) AS total_candles
      FROM market_data_points
      WHERE provider = ${toHarvesterProvider(exchange)}
        AND symbol = ${toHarvesterSymbol(symbol)}
        AND interval = '1m'
    `;
    const row = rows[0];
    return {
      earliest: row?.earliest ?? null,
      latest: row?.latest ?? null,
      totalCandles: Number(row?.total_candles ?? 0),
      gapCount: 0,
    };
  }

  async getQualityMetrics(input: { exchange?: string; symbol?: string } = {}) {
    const clauses = [];
    if (input.exchange) clauses.push(this.sql`s.provider = ${toHarvesterProvider(input.exchange)}`);
    if (input.symbol) clauses.push(this.sql`s.symbol = ${toHarvesterSymbol(input.symbol)}`);

    const where =
      clauses.length > 0
        ? this.sql`WHERE ${clauses.reduce((acc, clause) => this.sql`${acc} AND ${clause}`)}`
        : this.sql``;

    const rows = await this.sql<
      Array<{
        exchange: string;
        symbol: string;
        timeframe: string;
        status: string | null;
        earliest: Date | null;
        latest: Date | null;
        total_candles: string | number | null;
        start_time: Date | null;
        next_start_time: Date | null;
        latest_available_time: Date | null;
        updated_at: Date | null;
      }>
    >`
      WITH states AS (
        SELECT
          provider,
          symbol,
          interval,
          status,
          start_time,
          next_start_time,
          latest_available_time,
          total_inserted,
          updated_at
        FROM market_data_backfills
        UNION ALL
        SELECT
          provider,
          symbol,
          interval,
          status,
          start_time,
          next_start_time,
          latest_available_time,
          total_inserted,
          updated_at
        FROM market_rollup_backfills
      )
      SELECT
        s.provider AS exchange,
        s.symbol,
        s.interval AS timeframe,
        s.status,
        s.start_time AS earliest,
        s.next_start_time AS latest,
        s.total_inserted AS total_candles,
        s.start_time,
        s.next_start_time,
        s.latest_available_time,
        s.updated_at
      FROM states s
      ${where}
      ORDER BY s.provider, s.symbol, s.interval
    `;

    return rows.map((row) => serializeQualityMetric(row));
  }

  async close() {
    await this.sql.end();
  }

  private async getNativeCoverage(
    exchange: string,
    symbol: string,
    timeframe: string
  ): Promise<MarketCoverage> {
    const provider = toHarvesterProvider(exchange);
    const harvesterSymbol = toHarvesterSymbol(symbol);
    const interval = toHarvesterInterval(timeframe);

    if (interval !== "1m") {
      const rollupStateRows = await this.sql<
        Array<{
          earliest: Date | null;
          latest: Date | null;
          total_candles: string | number | null;
        }>
      >`
        SELECT
          start_time AS earliest,
          next_start_time AS latest,
          total_inserted AS total_candles
        FROM market_rollup_backfills
        WHERE provider = ${provider}
          AND symbol = ${harvesterSymbol}
          AND interval = ${interval}
        LIMIT 1
      `;

      const rollupRow = rollupStateRows[0];
      if (rollupRow?.earliest && rollupRow.latest) {
        return {
          earliest: rollupRow.earliest,
          latest: rollupRow.latest,
          totalCandles: Number(rollupRow.total_candles ?? 0),
          gapCount: 0,
        };
      }
    }

    const rows = await this.sql<
      { earliest: Date | null; latest: Date | null; total_candles: string | number | null }[]
    >`
      SELECT
        first.timestamp AS earliest,
        latest.timestamp AS latest,
        NULL::integer AS total_candles
      FROM (SELECT 1) marker
      LEFT JOIN LATERAL (
        SELECT timestamp
        FROM market_data_points
        WHERE provider = ${provider}
          AND symbol = ${harvesterSymbol}
          AND interval = ${interval}
        ORDER BY timestamp ASC
        LIMIT 1
      ) first ON true
      LEFT JOIN LATERAL (
        SELECT timestamp
        FROM market_data_points
        WHERE provider = ${provider}
          AND symbol = ${harvesterSymbol}
          AND interval = ${interval}
        ORDER BY timestamp DESC
        LIMIT 1
      ) latest ON true
    `;
    const row = rows[0];
    const totalCandles =
      row?.earliest && row.latest
        ? Math.floor((row.latest.getTime() - row.earliest.getTime()) / timeframeToMs(timeframe)) + 1
        : 0;
    return {
      earliest: row?.earliest ?? null,
      latest: row?.latest ?? null,
      totalCandles,
      gapCount: 0,
    };
  }

  private async *streamNativeIntervalCandles(
    params: MarketCandleStreamParams,
    batchSize: number
  ): AsyncIterable<MarketCandle[]> {
    let cursor: Date | undefined;

    while (true) {
      const timeClause = cursor
        ? this.sql`timestamp > ${cursor}`
        : this.sql`timestamp >= ${params.startTime}`;

      const rows = await this.sql<HarvesterCandleRow[]>`
      SELECT provider, symbol, interval, timestamp, open, high, low, close, volume
      FROM market_data_points
      WHERE provider = ${toHarvesterProvider(params.exchange)}
        AND symbol = ${toHarvesterSymbol(params.symbol)}
        AND interval = ${toHarvesterInterval(params.timeframe)}
        AND ${timeClause}
        AND timestamp <= ${params.endTime}
      ORDER BY timestamp ASC
      LIMIT ${batchSize}
    `;

      if (rows.length === 0) return;

      yield rows.map((row) =>
        mapHarvesterCandle(row, params.exchange, params.symbol, params.timeframe)
      );
      cursor = rows[rows.length - 1]?.timestamp;
      if (rows.length < batchSize) return;
    }
  }

  private async *streamRollupCandles(
    params: MarketCandleStreamParams,
    batchSize: number
  ): AsyncIterable<MarketCandle[]> {
    const bucketMs = timeframeToMs(params.timeframe);
    const expectedSourcePoints = Math.floor(bucketMs / timeframeToMs("1m"));
    let cursor: Date | undefined;

    while (true) {
      const lowerBound = cursor ? new Date(cursor.getTime() + bucketMs) : params.startTime;
      if (lowerBound > params.endTime) return;

      const upperBound = new Date(
        Math.min(params.endTime.getTime(), lowerBound.getTime() + bucketMs * batchSize - 1)
      );

      const rows = await this.sql<HarvesterCandleRow[]>`
        WITH bucketed AS (
          SELECT
            provider,
            symbol,
            date_bin(${bucketMs} * interval '1 millisecond', timestamp, TIMESTAMPTZ '1970-01-01') AS bucket,
            timestamp,
            open,
            high,
            low,
            close,
            volume
          FROM market_data_points
          WHERE provider = ${toHarvesterProvider(params.exchange)}
            AND symbol = ${toHarvesterSymbol(params.symbol)}
            AND interval = '1m'
            AND timestamp >= ${lowerBound}
            AND timestamp <= ${upperBound}
        ),
        rolled AS (
          SELECT
            provider,
            symbol,
            ${params.timeframe}::text AS interval,
            bucket AS timestamp,
            (array_agg(open ORDER BY timestamp ASC))[1] AS open,
            MAX(high) AS high,
            MIN(low) AS low,
            (array_agg(close ORDER BY timestamp DESC))[1] AS close,
            SUM(COALESCE(volume, 0)) AS volume,
            COUNT(*)::int AS trades_count,
            ${expectedSourcePoints}::int AS expected_points
          FROM bucketed
          GROUP BY provider, symbol, bucket
        )
        SELECT provider, symbol, interval, timestamp, open, high, low, close, volume, trades_count
        FROM rolled
        WHERE trades_count = expected_points
        ORDER BY timestamp ASC
        LIMIT ${batchSize}
      `;

      if (rows.length === 0) {
        cursor = upperBound;
        continue;
      }

      yield rows.map((row) =>
        mapHarvesterCandle(row, params.exchange, params.symbol, params.timeframe)
      );
      cursor = rows[rows.length - 1]?.timestamp;
      if (upperBound >= params.endTime && rows.length < batchSize) return;
    }
  }
}

class LocalDrizzleMarketDataReader implements MarketDataReader {
  constructor(private readonly db: Database) {}

  async getLatestCandle(exchange: string, symbol: string, timeframe = "1m") {
    const rows = await this.db
      .select()
      .from(ohlcv)
      .where(
        and(eq(ohlcv.exchange, exchange), eq(ohlcv.symbol, symbol), eq(ohlcv.timeframe, timeframe))
      )
      .orderBy(desc(ohlcv.time))
      .limit(1);
    return rows[0] ?? null;
  }

  async getCandles(params: {
    exchange: string;
    symbol: string;
    timeframe: string;
    startTime?: Date;
    endTime?: Date;
    limit: number;
  }) {
    if (params.timeframe !== "1m") {
      const latest =
        params.endTime ?? (await this.getLatestCandle(params.exchange, params.symbol, "1m"))?.time;
      if (!latest) return [];
      const start =
        params.startTime ??
        new Date(latest.getTime() - timeframeToMs(params.timeframe) * (params.limit + 1));
      const rows = await queryOHLCVByRange(
        this.db,
        params.exchange,
        params.symbol,
        "1m",
        start,
        latest
      );
      return rollupCandles(rows, params.timeframe).slice(-params.limit);
    }

    if (params.startTime || params.endTime) {
      const rows = await queryOHLCVByRange(
        this.db,
        params.exchange,
        params.symbol,
        "1m",
        params.startTime ?? new Date(0),
        params.endTime ?? new Date()
      );
      return rows.slice(-params.limit);
    }

    const rows = await this.db
      .select()
      .from(ohlcv)
      .where(
        and(
          eq(ohlcv.exchange, params.exchange),
          eq(ohlcv.symbol, params.symbol),
          eq(ohlcv.timeframe, "1m")
        )
      )
      .orderBy(desc(ohlcv.time))
      .limit(params.limit);
    return rows.reverse();
  }

  async *streamCandles(
    params: MarketCandleStreamParams,
    batchSize: number = 10_000
  ): AsyncIterable<MarketCandle[]> {
    if (params.timeframe !== "1m") {
      const rows = await queryOHLCVByRange(
        this.db,
        params.exchange,
        params.symbol,
        "1m",
        params.startTime,
        params.endTime
      );
      const rolled = rollupCandles(rows, params.timeframe);
      for (let i = 0; i < rolled.length; i += batchSize) {
        yield rolled.slice(i, i + batchSize);
      }
      return;
    }

    let cursor: Date | undefined;
    while (true) {
      const conditions = [
        eq(ohlcv.exchange, params.exchange),
        eq(ohlcv.symbol, params.symbol),
        eq(ohlcv.timeframe, params.timeframe),
        gte(ohlcv.time, params.startTime),
        lte(ohlcv.time, params.endTime),
      ];
      if (cursor) conditions.push(gt(ohlcv.time, cursor));

      const rows = await this.db
        .select()
        .from(ohlcv)
        .where(and(...conditions))
        .orderBy(ohlcv.time)
        .limit(batchSize);

      if (rows.length === 0) return;
      yield rows;
      cursor = rows[rows.length - 1]?.time;
      if (rows.length < batchSize) return;
    }
  }

  async getSymbols(exchange: string) {
    const rows = await this.db
      .select({ symbol: ohlcv.symbol })
      .from(ohlcv)
      .where(eq(ohlcv.exchange, exchange))
      .groupBy(ohlcv.symbol)
      .orderBy(asc(ohlcv.symbol));
    return rows.map((row) => row.symbol);
  }

  async getCoverage(exchange: string, symbol: string, timeframe: string): Promise<MarketCoverage> {
    const rows = await this.db
      .select({
        earliest: drizzleSql<Date | null>`MIN(${ohlcv.time})`,
        latest: drizzleSql<Date | null>`MAX(${ohlcv.time})`,
        totalCandles: drizzleSql<string>`COUNT(*)`,
      })
      .from(ohlcv)
      .where(
        and(eq(ohlcv.exchange, exchange), eq(ohlcv.symbol, symbol), eq(ohlcv.timeframe, timeframe))
      );
    const row = rows[0];
    return {
      earliest: row?.earliest ?? null,
      latest: row?.latest ?? null,
      totalCandles: Number(row?.totalCandles ?? 0),
      gapCount: 0,
    };
  }

  async getQualityMetrics(input: { exchange?: string; symbol?: string } = {}) {
    const conditions = [];
    if (input.exchange) conditions.push(eq(ohlcv.exchange, input.exchange));
    if (input.symbol) conditions.push(eq(ohlcv.symbol, input.symbol));

    const rows = await this.db
      .select({
        exchange: ohlcv.exchange,
        symbol: ohlcv.symbol,
        timeframe: ohlcv.timeframe,
        earliest: drizzleSql<Date | null>`MIN(${ohlcv.time})`,
        latest: drizzleSql<Date | null>`MAX(${ohlcv.time})`,
        totalCandles: drizzleSql<string>`COUNT(*)`,
      })
      .from(ohlcv)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(ohlcv.exchange, ohlcv.symbol, ohlcv.timeframe)
      .orderBy(ohlcv.exchange, ohlcv.symbol, ohlcv.timeframe);

    return rows.map((row) =>
      serializeQualityMetric({
        exchange: row.exchange,
        symbol: row.symbol,
        timeframe: row.timeframe,
        status: "local",
        earliest: row.earliest,
        latest: row.latest,
        total_candles: row.totalCandles,
        start_time: row.earliest,
        next_start_time: null,
        latest_available_time: row.latest,
        updated_at: row.latest,
      })
    );
  }
}

type HarvesterCandleRow = {
  provider: string;
  symbol: string;
  interval: string;
  timestamp: Date;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string | null;
  trades_count?: number | string | null;
};

function mapHarvesterCandle(
  row: HarvesterCandleRow,
  exchange: string,
  symbol: string,
  timeframe: string
): MarketCandle {
  return {
    exchange,
    symbol,
    timeframe,
    time: row.timestamp,
    open: String(row.open),
    high: String(row.high),
    low: String(row.low),
    close: String(row.close),
    volume: String(row.volume ?? 0),
    tradesCount: row.trades_count == null ? 0 : Number(row.trades_count),
  };
}

export function rollupCandles(rows: MarketCandle[], targetTimeframe: string): MarketCandle[] {
  const bucketMs = timeframeToMs(targetTimeframe);
  const buckets = new Map<string, MarketCandle>();

  for (const row of rows) {
    const bucketTime = Math.floor(row.time.getTime() / bucketMs) * bucketMs;
    const key = String(bucketTime);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, startRollupCandle(row, targetTimeframe, bucketTime));
      continue;
    }

    mergeRollupCandle(existing, row);
  }

  return [...buckets.values()].sort((a, b) => a.time.getTime() - b.time.getTime());
}

function startRollupCandle(
  row: MarketCandle,
  targetTimeframe: string,
  bucketTime: number
): MarketCandle {
  return {
    ...row,
    timeframe: targetTimeframe,
    time: new Date(bucketTime),
  };
}

function mergeRollupCandle(existing: MarketCandle, row: MarketCandle) {
  existing.high = Math.max(Number(existing.high), Number(row.high)).toString();
  existing.low = Math.min(Number(existing.low), Number(row.low)).toString();
  existing.close = row.close;
  existing.volume = (Number(existing.volume) + Number(row.volume)).toString();
  existing.tradesCount = (existing.tradesCount ?? 0) + (row.tradesCount ?? 0);
}

function serializeQualityMetric(row: {
  exchange: string;
  symbol: string;
  timeframe: string;
  status: string | null;
  earliest: Date | null;
  latest: Date | null;
  total_candles: string | number | null;
  start_time?: Date | null;
  next_start_time?: Date | null;
  latest_available_time?: Date | null;
  updated_at: Date | null;
}): MarketQualityMetric {
  const latest = row.latest;
  const totalCandles = Number(row.total_candles ?? 0);
  const timeframe = fromHarvesterInterval(row.timeframe);
  const completeness = estimateCompleteness(timeframe, totalCandles, row.earliest, latest);

  return {
    exchange: row.exchange,
    symbol: fromHarvesterSymbol(row.symbol),
    timeframe,
    totalCandles,
    gapCount: 0,
    earliest: row.earliest?.toISOString() ?? null,
    latest: latest?.toISOString() ?? null,
    startTime: row.start_time?.toISOString() ?? null,
    nextStartTime: row.next_start_time?.toISOString() ?? null,
    latestAvailableTime: row.latest_available_time?.toISOString() ?? null,
    latestCandleAgeMs: latest ? Date.now() - latest.getTime() : null,
    websocketStatus: "external",
    restFallbackCount: 0,
    validationFailures: 0,
    apiErrors: 0,
    repairFailures: 0,
    backfillBacklog: 0,
    candlesInserted: totalCandles,
    missingCandles: completeness.missingCandles,
    completenessPct: completeness.percent.toFixed(2),
    lastUpdated: row.updated_at?.toISOString() ?? latest?.toISOString() ?? null,
    status: row.status ?? "idle",
  };
}

function estimateCompleteness(
  timeframe: string,
  totalCandles: number,
  earliest: Date | null,
  latest: Date | null
) {
  if (!earliest || !latest) {
    return { percent: totalCandles > 0 ? 100 : 0, missingCandles: 0 };
  }

  try {
    const intervalMs = timeframeToMs(timeframe);
    const expected = Math.max(
      Math.floor((latest.getTime() - earliest.getTime()) / intervalMs) + 1,
      0
    );
    if (expected === 0) return { percent: 0, missingCandles: 0 };
    return {
      percent: Math.min((totalCandles / expected) * 100, 100),
      missingCandles: Math.max(expected - totalCandles, 0),
    };
  } catch {
    return { percent: totalCandles > 0 ? 100 : 0, missingCandles: 0 };
  }
}

export function nativeCoversRange(coverage: MarketCoverage, params: MarketCandleStreamParams) {
  if (!coverage.earliest || !coverage.latest || coverage.totalCandles === 0) return false;
  const bucketMs = timeframeToMs(params.timeframe);
  const requiredStart = new Date(Math.ceil(params.startTime.getTime() / bucketMs) * bucketMs);
  const currentBucketStart = Math.floor(params.endTime.getTime() / bucketMs) * bucketMs;
  const requiredEnd = new Date(currentBucketStart - bucketMs);
  if (requiredEnd < requiredStart) return false;

  const coverageExpected =
    Math.floor((coverage.latest.getTime() - coverage.earliest.getTime()) / bucketMs) + 1;
  const density = coverageExpected > 0 ? coverage.totalCandles / coverageExpected : 0;

  return coverage.earliest <= requiredStart && coverage.latest >= requiredEnd && density >= 0.98;
}

export function toHarvesterProvider(exchange: string) {
  return exchange.toLowerCase();
}

export function toHarvesterSymbol(symbol: string) {
  return symbol.replace("/", "").toUpperCase();
}

export function fromHarvesterSymbol(symbol: string) {
  if (symbol.includes("/")) return symbol;
  if (symbol.endsWith("USDT")) return `${symbol.slice(0, -4)}/USDT`;
  if (symbol.endsWith("USD")) return `${symbol.slice(0, -3)}/USD`;
  return symbol;
}

export function toHarvesterInterval(timeframe: string) {
  if (timeframe === "1w") return "1W";
  return timeframe;
}

export function fromHarvesterInterval(interval: string) {
  if (interval === "1W") return "1w";
  return interval;
}
