import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Database } from "@tb/db";
import { describe, expect, it, vi } from "vitest";

import type {
  MarketCandle,
  MarketCandleStreamParams,
  MarketDataReader,
} from "../services/harvesterMarketData";

import { runMarketDataExport } from "./dataPipelineWorkers";

describe("dataPipelineWorkers", () => {
  it("exports candles from the shared MarketDataReader instead of platform-local OHLCV", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "tb-export-"));
    const updates: Array<Record<string, unknown>> = [];
    const db = {
      update: vi.fn(() => ({
        set: vi.fn((payload: Record<string, unknown>) => {
          updates.push(payload);
          return {
            where: vi.fn(async () => []),
          };
        }),
      })),
    } as unknown as Database;
    const marketData = new FakeMarketDataReader();

    try {
      const result = await runMarketDataExport(db, marketData, {
        exportId: "9bdb62a2-219a-4f95-8f9c-2b9878c5220e",
        exchange: "binance",
        symbols: ["btc/usdt", "BTC/USDT", "ETH/USDT"],
        timeframe: "15m",
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: "2026-01-01T01:00:00.000Z",
        format: "csv",
        compressed: false,
        compressionFormat: "gzip",
        outputDir,
      });

      const csv = await readFile(result.filePath, "utf8");

      expect(result.rowCount).toBe(3);
      expect(result.fileSize).toBeGreaterThan(0);
      expect(csv).toContain(
        "time,exchange,symbol,timeframe,open,high,low,close,volume,trades_count"
      );
      expect(csv).toContain("2026-01-01T00:00:00.000Z,binance,BTC/USDT,15m,100,101,99,100.5,42,7");
      expect(csv).toContain("2026-01-01T00:15:00.000Z,binance,ETH/USDT,15m,200,202,198,201,80,11");
      expect(marketData.streamCalls).toEqual(["BTC/USDT", "ETH/USDT"]);
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: "processing", progress: 0 }),
          expect.objectContaining({ status: "processing", progress: 35 }),
          expect.objectContaining({ status: "processing", progress: 70 }),
          expect.objectContaining({ status: "processing", progress: 80 }),
          expect.objectContaining({
            status: "completed",
            progress: 100,
            filePath: result.filePath,
            rowCount: 3,
          }),
        ])
      );
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

class FakeMarketDataReader implements MarketDataReader {
  readonly streamCalls: string[] = [];
  private readonly candlesBySymbol = new Map<string, MarketCandle[]>([
    [
      "BTC/USDT",
      [
        candle("BTC/USDT", "2026-01-01T00:00:00.000Z", "100", "101", "99", "100.5", "42", 7),
        candle("BTC/USDT", "2026-01-01T00:15:00.000Z", "101", "103", "100", "102", "50", 9),
      ],
    ],
    [
      "ETH/USDT",
      [candle("ETH/USDT", "2026-01-01T00:15:00.000Z", "200", "202", "198", "201", "80", 11)],
    ],
  ]);

  async getLatestCandle(_exchange: string, symbol: string) {
    return this.candlesBySymbol.get(symbol)?.at(-1) ?? null;
  }

  async getCandles() {
    return [];
  }

  async *streamCandles(params: MarketCandleStreamParams) {
    this.streamCalls.push(params.symbol);
    const rows = this.candlesBySymbol.get(params.symbol) ?? [];
    yield rows.filter((row) => row.time >= params.startTime && row.time <= params.endTime);
  }

  async getSymbols() {
    return [...this.candlesBySymbol.keys()];
  }

  async getCoverage(_exchange: string, symbol: string) {
    const rows = this.candlesBySymbol.get(symbol) ?? [];
    return {
      earliest: rows[0]?.time ?? null,
      latest: rows.at(-1)?.time ?? null,
      totalCandles: rows.length,
      gapCount: 0,
    };
  }

  async getQualityMetrics() {
    return [];
  }
}

function candle(
  symbol: string,
  time: string,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  tradesCount: number
): MarketCandle {
  return {
    exchange: "binance",
    symbol,
    timeframe: "15m",
    time: new Date(time),
    open,
    high,
    low,
    close,
    volume,
    tradesCount,
  };
}
