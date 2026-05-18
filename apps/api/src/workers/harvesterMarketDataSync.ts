import {
  dataCollectionStatus,
  ohlcv,
  logIngestionEvent,
  updateIngestionHealth,
  upsertOHLCV,
  type Database,
} from "@tb/db";
import { sql } from "drizzle-orm";
import type IORedis from "ioredis";

interface HarvesterSyncConfig {
  exchanges: string[];
  pairs: string[];
  timeframes: string[];
}

interface HarvesterMarketDataPoint {
  provider: string;
  symbol: string;
  interval: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

function toHarvesterProvider(exchange: string) {
  const normalized = exchange.toLowerCase();
  if (normalized === "binance") return "binance";
  return normalized;
}

function toHarvesterSymbol(symbol: string) {
  return symbol.replace("/", "").toUpperCase();
}

function syncJobId(exchange: string, symbol: string, timeframe: string) {
  return `tb-${exchange}-${symbol.replace(/[^a-z0-9]/gi, "-")}-${timeframe}`.toLowerCase();
}

function collectionTimeframes(_configuredTimeframes: string[]) {
  // Signal Harvester is the external rate-limited collector. Spend that budget on
  // the highest-resolution candles only; API/UI consumers can roll 1m candles up
  // into 5m/15m/1h/4h/1d locally when they need wider views.
  return ["1m"];
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Signal Harvester request failed ${response.status}: ${text || response.statusText}`
    );
  }
  return (await response.json()) as T;
}

export function startHarvesterMarketDataSync(options: {
  db: Database;
  redis: IORedis;
  harvesterUrl: string;
  config: HarvesterSyncConfig;
  intervalMs?: number;
}) {
  const baseUrl = options.harvesterUrl.replace(/\/$/, "");
  const intervalMs = options.intervalMs ?? 60_000;
  let stopped = false;
  let running = false;

  const syncOnce = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const timeframes = collectionTimeframes(options.config.timeframes);
      for (const exchange of options.config.exchanges) {
        const provider = toHarvesterProvider(exchange);
        for (const pair of options.config.pairs) {
          const symbol = toHarvesterSymbol(pair);
          for (const timeframe of timeframes) {
            const jobId = syncJobId(exchange, pair, timeframe);
            await requestJson(`${baseUrl}/api/financial-jobs`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                id: jobId,
                name: `${pair} ${timeframe} ${exchange} market data`,
                topic: pair.split("/")[0] ?? pair,
                provider,
                symbols: [symbol],
                interval: timeframe,
                scheduleMs: null,
              }),
            });

            await requestJson(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}/run`, {
              method: "POST",
            });

            const points = await requestJson<HarvesterMarketDataPoint[]>(
              `${baseUrl}/api/market-data?provider=${encodeURIComponent(provider)}&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=1000`
            );

            if (points.length > 0) {
              await upsertOHLCV(
                options.db,
                points.map((point) => ({
                  exchange,
                  symbol: pair,
                  timeframe,
                  time: new Date(point.timestamp),
                  open: String(point.open),
                  high: String(point.high),
                  low: String(point.low),
                  close: String(point.close),
                  volume: String(point.volume ?? 0),
                }))
              );
            }

            await options.db
              .insert(dataCollectionStatus)
              .values({
                exchange,
                symbol: pair,
                timeframe,
                status: "synced",
                lastCollectedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [
                  dataCollectionStatus.exchange,
                  dataCollectionStatus.symbol,
                  dataCollectionStatus.timeframe,
                ],
                set: {
                  status: "synced",
                  lastCollectedAt: sql`NOW()`,
                  latest: sql`(SELECT MAX(${ohlcv.time}) FROM ${ohlcv} WHERE ${ohlcv.exchange} = ${exchange} AND ${ohlcv.symbol} = ${pair} AND ${ohlcv.timeframe} = ${timeframe})`,
                  earliest: sql`(SELECT MIN(${ohlcv.time}) FROM ${ohlcv} WHERE ${ohlcv.exchange} = ${exchange} AND ${ohlcv.symbol} = ${pair} AND ${ohlcv.timeframe} = ${timeframe})`,
                  totalCandles: sql`(SELECT COUNT(*) FROM ${ohlcv} WHERE ${ohlcv.exchange} = ${exchange} AND ${ohlcv.symbol} = ${pair} AND ${ohlcv.timeframe} = ${timeframe})`,
                  errorMessage: null,
                  updatedAt: sql`NOW()`,
                },
              });

            await updateIngestionHealth(options.db, {
              exchange,
              symbol: pair,
              timeframe,
              latestCandleAt: points[0]?.timestamp ? new Date(points[0].timestamp) : undefined,
              candlesInsertedDelta: points.length,
            });

            await options.redis.publish(
              "data:status",
              JSON.stringify({
                exchange,
                symbol: pair,
                timeframe,
                status: "synced",
                source: "signal-harvester",
                rows: points.length,
                lastUpdated: Date.now(),
              })
            );
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await logIngestionEvent(options.db, {
        eventType: "harvester_sync_failed",
        severity: "error",
        message,
      }).catch(() => undefined);
      await options.redis.publish(
        "worker:error",
        JSON.stringify({ scope: "signal-harvester-sync", message, timestamp: Date.now() })
      );
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void syncOnce();
  }, intervalMs);
  void syncOnce();

  return {
    close: async () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
