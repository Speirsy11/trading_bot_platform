import type { Database } from "@tb/db";
import { ohlcv, queryOHLCVByRange } from "@tb/db";
import { timeframeToMs } from "@tb/trading-core";
import { and, asc, desc, eq, sql as drizzleSql } from "drizzle-orm";
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
  getSymbols(exchange: string): Promise<string[]>;
  getCoverage(exchange: string, symbol: string, timeframe: string): Promise<MarketCoverage>;
  close?: () => Promise<void>;
}

export function createHarvesterMarketDataReader(databaseUrl: string): MarketDataReader {
  return new HarvesterPostgresMarketDataReader(postgres(databaseUrl, { max: 8 }));
}

export function createLocalMarketDataReader(db: Database): MarketDataReader {
  return new LocalDrizzleMarketDataReader(db);
}

class HarvesterPostgresMarketDataReader implements MarketDataReader {
  constructor(private readonly sql: Sql) {}

  async getLatestCandle(exchange: string, symbol: string, timeframe = "1m") {
    const rows = await this.sql<HarvesterCandleRow[]>`
      SELECT provider, symbol, interval, timestamp, open, high, low, close, volume
      FROM market_data_points
      WHERE provider = ${toHarvesterProvider(exchange)}
        AND symbol = ${toHarvesterSymbol(symbol)}
        AND interval = ${timeframe}
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    return rows[0] ? mapHarvesterCandle(rows[0], exchange, symbol, timeframe) : null;
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
      const baseRows = await this.getSourceOneMinuteCandles(params);
      return rollupCandles(baseRows, params.timeframe).slice(-params.limit);
    }

    const clauses = [
      this.sql`provider = ${toHarvesterProvider(params.exchange)}`,
      this.sql`symbol = ${toHarvesterSymbol(params.symbol)}`,
      this.sql`interval = '1m'`,
    ];
    if (params.startTime) clauses.push(this.sql`timestamp >= ${params.startTime}`);
    if (params.endTime) clauses.push(this.sql`timestamp <= ${params.endTime}`);

    const rows = await this.sql<HarvesterCandleRow[]>`
      SELECT provider, symbol, interval, timestamp, open, high, low, close, volume
      FROM market_data_points
      WHERE ${clauses.reduce((acc, clause) => this.sql`${acc} AND ${clause}`)}
      ORDER BY timestamp DESC
      LIMIT ${params.limit}
    `;

    return rows
      .reverse()
      .map((row) => mapHarvesterCandle(row, params.exchange, params.symbol, "1m"));
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
      const oneMinute = await this.getCoverage(exchange, symbol, "1m");
      if (!oneMinute.earliest || !oneMinute.latest) return oneMinute;
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
        b.start_time AS earliest,
        latest.timestamp AS latest,
        b.total_inserted AS total_candles
      FROM market_data_backfills b
      LEFT JOIN LATERAL (
        SELECT timestamp
        FROM market_data_points p
        WHERE p.provider = b.provider
          AND p.symbol = b.symbol
          AND p.interval = b.interval
        ORDER BY timestamp DESC
        LIMIT 1
      ) latest ON true
      WHERE b.provider = ${toHarvesterProvider(exchange)}
        AND b.symbol = ${toHarvesterSymbol(symbol)}
        AND b.interval = '1m'
      LIMIT 1
    `;
    const row = rows[0];
    return {
      earliest: row?.earliest ?? null,
      latest: row?.latest ?? null,
      totalCandles: Number(row?.total_candles ?? 0),
      gapCount: 0,
    };
  }

  async close() {
    await this.sql.end();
  }

  private async getSourceOneMinuteCandles(params: {
    exchange: string;
    symbol: string;
    timeframe: string;
    startTime?: Date;
    endTime?: Date;
    limit: number;
  }) {
    const endTime =
      params.endTime ?? (await this.getLatestCandle(params.exchange, params.symbol, "1m"))?.time;
    if (!endTime) return [];
    const startTime =
      params.startTime ??
      new Date(endTime.getTime() - timeframeToMs(params.timeframe) * (params.limit + 1));

    const rows = await this.sql<HarvesterCandleRow[]>`
      SELECT provider, symbol, interval, timestamp, open, high, low, close, volume
      FROM market_data_points
      WHERE provider = ${toHarvesterProvider(params.exchange)}
        AND symbol = ${toHarvesterSymbol(params.symbol)}
        AND interval = '1m'
        AND timestamp >= ${startTime}
        AND timestamp <= ${endTime}
      ORDER BY timestamp ASC
    `;
    return rows.map((row) => mapHarvesterCandle(row, params.exchange, params.symbol, "1m"));
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
    tradesCount: 0,
  };
}

function rollupCandles(rows: MarketCandle[], targetTimeframe: string): MarketCandle[] {
  const bucketMs = timeframeToMs(targetTimeframe);
  const buckets = new Map<string, MarketCandle>();

  for (const row of rows) {
    const bucketTime = Math.floor(row.time.getTime() / bucketMs) * bucketMs;
    const key = String(bucketTime);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        ...row,
        timeframe: targetTimeframe,
        time: new Date(bucketTime),
      });
      continue;
    }

    existing.high = Math.max(Number(existing.high), Number(row.high)).toString();
    existing.low = Math.min(Number(existing.low), Number(row.low)).toString();
    existing.close = row.close;
    existing.volume = (Number(existing.volume) + Number(row.volume)).toString();
    existing.tradesCount = (existing.tradesCount ?? 0) + (row.tradesCount ?? 0);
  }

  return [...buckets.values()].sort((a, b) => a.time.getTime() - b.time.getTime());
}

function toHarvesterProvider(exchange: string) {
  return exchange.toLowerCase();
}

function toHarvesterSymbol(symbol: string) {
  return symbol.replace("/", "").toUpperCase();
}

function fromHarvesterSymbol(symbol: string) {
  if (symbol.endsWith("USDT")) return `${symbol.slice(0, -4)}/USDT`;
  if (symbol.endsWith("USD")) return `${symbol.slice(0, -3)}/USD`;
  return symbol;
}
