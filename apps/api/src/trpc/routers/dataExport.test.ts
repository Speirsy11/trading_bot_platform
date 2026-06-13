import { describe, expect, it, vi } from "vitest";

import { createTrpcContext } from "../context";
import { createCaller } from "../router";

const exportId = "0dccf49d-9071-435a-9188-0b6edb223c21";

function createExportRow(values: Record<string, unknown>) {
  return {
    id: exportId,
    exchange: values.exchange,
    symbols: values.symbols,
    timeframe: values.timeframe,
    startTime: values.startTime,
    endTime: values.endTime,
    format: values.format,
    compressed: values.compressed,
    filePath: null,
    fileSize: null,
    rowCount: null,
    status: values.status,
    progress: values.progress,
    error: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: null,
  };
}

function createExportCaller(options: {
  db: unknown;
  dataExportQueue: unknown;
  authorization?: string;
}) {
  return createCaller(
    createTrpcContext(
      {
        db: options.db as never,
        redis: {} as never,
        queues: {
          dataExportQueue: options.dataExportQueue,
          close: async () => undefined,
        } as never,
        exchangeManager: {} as never,
        marketData: {} as never,
        keyVault: {} as never,
        exportsDir: "/tmp/trading-bot-platform-exports",
      },
      {
        headers: options.authorization ? { authorization: options.authorization } : {},
      } as never
    )
  );
}

describe("data export router", () => {
  it("queues exports with normalized symbols", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const insertedValues: Array<Record<string, unknown>> = [];
    const deleteWhere = vi.fn(async () => []);
    const add = vi.fn().mockResolvedValue({ id: `export-${exportId}` });
    const db = {
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => {
          insertedValues.push(values);
          return {
            returning: vi.fn().mockResolvedValue([createExportRow(values)]),
          };
        }),
      })),
      delete: vi.fn(() => ({ where: deleteWhere })),
    };

    try {
      const caller = createExportCaller({
        db,
        dataExportQueue: { add },
        authorization: "Bearer test-token",
      });

      const result = await caller.dataExport.create({
        exchange: "binance",
        symbols: ["btc/usdt", " BTC/USDT ", "eth/usdt"],
        timeframe: "15m",
        startTime: Date.parse("2026-01-01T00:00:00.000Z"),
        endTime: Date.parse("2026-01-02T00:00:00.000Z"),
        format: "csv",
        compress: true,
        compressionFormat: "gzip",
      });

      expect(result).toEqual({ exportId });
      expect(insertedValues[0]).toMatchObject({
        exchange: "binance",
        symbols: ["BTC/USDT", "ETH/USDT"],
        timeframe: "15m",
        status: "pending",
        progress: 0,
      });
      expect(add).toHaveBeenCalledWith(
        "export-data",
        expect.objectContaining({
          exportId,
          exchange: "binance",
          symbols: ["BTC/USDT", "ETH/USDT"],
          timeframe: "15m",
          startTime: "2026-01-01T00:00:00.000Z",
          endTime: "2026-01-02T00:00:00.000Z",
          format: "csv",
          compressed: true,
          compressionFormat: "gzip",
          outputDir: "/tmp/trading-bot-platform-exports",
        }),
        expect.objectContaining({ jobId: `export-${exportId}` })
      );
      expect(db.delete).not.toHaveBeenCalled();
      expect(deleteWhere).not.toHaveBeenCalled();
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });

  it("deletes the inserted export row when queueing fails", async () => {
    const previousAuthToken = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = "test-token";

    const deleteWhere = vi.fn(async () => []);
    const add = vi.fn().mockRejectedValue(new Error("redis down"));
    const db = {
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => ({
          returning: vi.fn().mockResolvedValue([createExportRow(values)]),
        })),
      })),
      delete: vi.fn(() => ({ where: deleteWhere })),
    };

    try {
      const caller = createExportCaller({
        db,
        dataExportQueue: { add },
        authorization: "Bearer test-token",
      });

      await expect(
        caller.dataExport.create({
          exchange: "binance",
          symbols: ["btc/usdt", "BTC/USDT"],
          timeframe: "1h",
          startTime: Date.parse("2026-01-01T00:00:00.000Z"),
          endTime: Date.parse("2026-01-02T00:00:00.000Z"),
          format: "parquet",
          compress: false,
          compressionFormat: "zstd",
        })
      ).rejects.toThrow(/Failed to enqueue data export job/);

      expect(add).toHaveBeenCalledWith(
        "export-data",
        expect.objectContaining({
          exportId,
          symbols: ["BTC/USDT"],
          compressed: false,
          compressionFormat: "zstd",
        }),
        expect.objectContaining({ jobId: `export-${exportId}` })
      );
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(deleteWhere).toHaveBeenCalledTimes(1);
    } finally {
      if (previousAuthToken === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previousAuthToken;
      }
    }
  });
});
