import {
  createCollectionWorker,
  createBackfillWorker,
  createExportWorker,
  CandleBuilder,
  WebSocketManager,
} from "@tb/data-pipeline";
import {
  dataCollectionStatus,
  ohlcv,
  insertMarketTickers,
  insertOrderBookSnapshots,
  logIngestionEvent,
  updateIngestionHealth,
  upsertMarketTrades,
  upsertOHLCV,
  type Database,
} from "@tb/db";
import { sql } from "drizzle-orm";
import type IORedis from "ioredis";

import {
  ohlcvCandlesCollected,
  ohlcvCollectionDuration,
  ohlcvCollectionErrors,
} from "../utils/metrics";

export function createDataPipelineWorkers(options: {
  db: Database;
  redis: IORedis;
  exportsDir: string;
}) {
  const redisConnection = {
    host: options.redis.options.host ?? "127.0.0.1",
    port: options.redis.options.port ?? 6379,
  };

  const collectionWorker = createCollectionWorker({
    db: options.db,
    redisConnection,
    exportDir: options.exportsDir,
  });
  const backfillWorker = createBackfillWorker({
    db: options.db,
    redisConnection,
    exportDir: options.exportsDir,
  });
  const exportWorker = createExportWorker({
    db: options.db,
    redisConnection,
    exportDir: options.exportsDir,
  });

  collectionWorker.on("completed", async (job, result) => {
    const duration = (job.finishedOn ?? Date.now()) - (job.processedOn ?? Date.now());
    if (typeof result?.inserted === "number") {
      ohlcvCandlesCollected.inc(
        { exchange: job.data.exchange, symbol: job.data.symbol, timeframe: job.data.timeframe },
        result.inserted
      );
    }
    ohlcvCollectionDuration.observe({ exchange: job.data.exchange }, duration);
    try {
      await options.redis.publish(
        "data:status",
        JSON.stringify({
          exchange: job.data.exchange,
          symbol: job.data.symbol,
          timeframe: job.data.timeframe,
          status: "idle",
          result,
          lastUpdated: Date.now(),
        })
      );
    } catch (error) {
      console.error("Failed to publish data-collection completion", error);
    }
  });
  collectionWorker.on("failed", async (job, error) => {
    if (job) {
      ohlcvCollectionErrors.inc({
        exchange: job.data.exchange,
        symbol: job.data.symbol,
        timeframe: job.data.timeframe,
      });
    }
    try {
      await options.redis.publish(
        "worker:error",
        JSON.stringify({
          scope: "data-collection",
          jobId: job?.id,
          message: error.message,
          timestamp: Date.now(),
        })
      );
    } catch (publishError) {
      console.error("Failed to publish data-collection failure", publishError);
    }
  });
  backfillWorker.on("failed", async (job, error) => {
    try {
      await options.redis.publish(
        "worker:error",
        JSON.stringify({
          scope: "data-backfill",
          jobId: job?.id,
          message: error.message,
          timestamp: Date.now(),
        })
      );
    } catch (publishError) {
      console.error("Failed to publish data-backfill failure", publishError);
    }
  });
  exportWorker.on("completed", async (job) => {
    try {
      await options.redis.publish(
        "data:status",
        JSON.stringify({
          exportId: job?.data?.exportId,
          status: "completed",
          lastUpdated: Date.now(),
        })
      );
    } catch (error) {
      console.error("Failed to publish data-export completion", error);
    }
  });
  exportWorker.on("failed", async (job, error) => {
    try {
      await options.redis.publish(
        "worker:error",
        JSON.stringify({
          scope: "data-export",
          exportId: job?.data?.exportId,
          message: error.message,
          timestamp: Date.now(),
        })
      );
    } catch (publishError) {
      console.error("Failed to publish data-export failure", publishError);
    }
  });

  return {
    collectionWorker,
    backfillWorker,
    exportWorker,
  };
}

interface LiveCollectorConfig {
  exchanges: string[];
  pairs: string[];
  timeframes: string[];
}

interface LiveCandleEvent {
  exchange: string;
  symbol: string;
  timeframe: string;
  candle: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

interface LiveTradeEvent {
  exchange: string;
  symbol: string;
  trade: {
    id?: string;
    side?: string;
    price: number;
    amount: number;
    cost?: number;
    timestamp: number;
    raw?: unknown;
  };
}

interface LiveTickerEvent {
  exchange: string;
  symbol: string;
  ticker: {
    bid?: number;
    ask?: number;
    last: number;
    volume?: number;
    change24h?: number;
    timestamp: number;
    raw?: unknown;
  };
}

interface LiveOrderBookEvent {
  exchange: string;
  symbol: string;
  orderBook: {
    bids: [number, number][];
    asks: [number, number][];
    timestamp: number;
    raw?: unknown;
  };
}

interface LiveConnectionEvent {
  exchange: string;
  symbol: string;
  timeframe: string;
  status: "connected" | "disconnected";
  stream: string;
}

async function refreshLiveStats(db: Database, exchange: string, symbol: string, timeframe: string) {
  await db
    .insert(dataCollectionStatus)
    .values({ exchange, symbol, timeframe, status: "streaming", lastCollectedAt: new Date() })
    .onConflictDoUpdate({
      target: [
        dataCollectionStatus.exchange,
        dataCollectionStatus.symbol,
        dataCollectionStatus.timeframe,
      ],
      set: {
        status: "streaming",
        lastCollectedAt: sql`NOW()`,
        earliest: sql`(SELECT MIN(${ohlcv.time}) FROM ${ohlcv} WHERE ${ohlcv.exchange} = ${exchange} AND ${ohlcv.symbol} = ${symbol} AND ${ohlcv.timeframe} = ${timeframe})`,
        latest: sql`(SELECT MAX(${ohlcv.time}) FROM ${ohlcv} WHERE ${ohlcv.exchange} = ${exchange} AND ${ohlcv.symbol} = ${symbol} AND ${ohlcv.timeframe} = ${timeframe})`,
        totalCandles: sql`(SELECT COUNT(*) FROM ${ohlcv} WHERE ${ohlcv.exchange} = ${exchange} AND ${ohlcv.symbol} = ${symbol} AND ${ohlcv.timeframe} = ${timeframe})`,
        errorMessage: null,
        updatedAt: sql`NOW()`,
      },
    });
}

export async function startLiveMarketDataCollector(options: {
  db: Database;
  redis: IORedis;
  config: LiveCollectorConfig;
}) {
  const manager = new WebSocketManager();
  const candleBuilder = new CandleBuilder(options.db);

  manager.on("connection", (event: LiveConnectionEvent) => {
    void updateIngestionHealth(options.db, {
      exchange: event.exchange,
      symbol: event.symbol,
      timeframe: event.timeframe,
      websocketStatus: event.status,
    }).catch(async (error: unknown) => {
      await logIngestionEvent(options.db, {
        exchange: event.exchange,
        symbol: event.symbol,
        timeframe: event.timeframe,
        eventType: "websocket_status",
        severity: event.status === "connected" ? "info" : "warn",
        message: `${event.stream} websocket ${event.status}`,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }).catch(() => undefined);
    });
  });

  manager.on("trade", (event: LiveTradeEvent) => {
    void (async () => {
      await upsertMarketTrades(options.db, [
        {
          exchange: event.exchange,
          symbol: event.symbol,
          tradeId: event.trade.id ?? null,
          side: event.trade.side ?? null,
          price: String(event.trade.price),
          amount: String(event.trade.amount),
          cost: event.trade.cost == null ? null : String(event.trade.cost),
          tradedAt: new Date(event.trade.timestamp),
          source: "websocket",
          raw: JSON.stringify(event.trade.raw ?? event.trade),
        },
      ]);
      await candleBuilder.buildFromTrades({
        exchange: event.exchange,
        symbol: event.symbol,
        startTime: new Date(event.trade.timestamp - 5 * 60_000),
        endTime: new Date(event.trade.timestamp + 60_000),
      });
    })().catch(async (error: unknown) => {
      await updateIngestionHealth(options.db, {
        exchange: event.exchange,
        symbol: event.symbol,
        timeframe: "1m",
        apiErrorsDelta: 1,
      });
      await logIngestionEvent(options.db, {
        exchange: event.exchange,
        symbol: event.symbol,
        timeframe: "1m",
        eventType: "trade_ingest_failed",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });

  manager.on("ticker", (event: LiveTickerEvent) => {
    void (async () => {
      await insertMarketTickers(options.db, [
        {
          exchange: event.exchange,
          symbol: event.symbol,
          bid: event.ticker.bid == null ? null : String(event.ticker.bid),
          ask: event.ticker.ask == null ? null : String(event.ticker.ask),
          last: String(event.ticker.last),
          volume: event.ticker.volume == null ? null : String(event.ticker.volume),
          change24h: event.ticker.change24h == null ? null : String(event.ticker.change24h),
          tickerAt: new Date(event.ticker.timestamp),
          source: "websocket",
          raw: JSON.stringify(event.ticker.raw ?? event.ticker),
        },
      ]);
      for (const timeframe of options.config.timeframes) {
        await updateIngestionHealth(options.db, {
          exchange: event.exchange,
          symbol: event.symbol,
          timeframe,
          latestEventAt: new Date(event.ticker.timestamp),
        });
      }
    })().catch(async (error: unknown) => {
      await logIngestionEvent(options.db, {
        exchange: event.exchange,
        symbol: event.symbol,
        eventType: "ticker_ingest_failed",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });

  manager.on("orderBook", (event: LiveOrderBookEvent) => {
    void (async () => {
      await insertOrderBookSnapshots(options.db, [
        {
          exchange: event.exchange,
          symbol: event.symbol,
          bids: event.orderBook.bids.slice(0, 100),
          asks: event.orderBook.asks.slice(0, 100),
          snapshotAt: new Date(event.orderBook.timestamp),
          source: "websocket",
          raw: JSON.stringify(event.orderBook.raw ?? event.orderBook),
        },
      ]);
    })().catch(async (error: unknown) => {
      await logIngestionEvent(options.db, {
        exchange: event.exchange,
        symbol: event.symbol,
        eventType: "orderbook_ingest_failed",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });

  manager.on("candle", (event: LiveCandleEvent) => {
    void (async () => {
      const { exchange, symbol, timeframe, candle } = event;
      await upsertOHLCV(options.db, [
        {
          exchange,
          symbol,
          timeframe,
          time: new Date(candle.time),
          open: String(candle.open),
          high: String(candle.high),
          low: String(candle.low),
          close: String(candle.close),
          volume: String(candle.volume),
        },
      ]);
      await refreshLiveStats(options.db, exchange, symbol, timeframe);
      await updateIngestionHealth(options.db, {
        exchange,
        symbol,
        timeframe,
        latestCandleAt: new Date(candle.time),
        candlesInsertedDelta: 1,
      });
      await options.redis.publish(
        "data:status",
        JSON.stringify({
          exchange,
          symbol,
          timeframe,
          status: "streaming",
          source: "websocket",
          lastUpdated: Date.now(),
        })
      );
    })().catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      await options.redis.publish(
        "worker:error",
        JSON.stringify({ scope: "live-market-data", message, timestamp: Date.now() })
      );
    });
  });

  for (const exchange of options.config.exchanges) {
    for (const symbol of options.config.pairs) {
      for (const timeframe of options.config.timeframes) {
        try {
          await manager.subscribe({ exchange, symbol, timeframe });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await options.redis.publish(
            "worker:error",
            JSON.stringify({
              scope: "live-market-data-subscribe",
              exchange,
              symbol,
              timeframe,
              message,
              timestamp: Date.now(),
            })
          );
        }
      }
    }
  }

  return manager;
}
