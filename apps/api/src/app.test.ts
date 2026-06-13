import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";
import { KeyVault } from "./services/keyVault";

interface CreateTestAppOverrides {
  dbExecute?: ReturnType<typeof vi.fn>;
  redisPing?: ReturnType<typeof vi.fn>;
}

async function createTestApp(overrides: CreateTestAppOverrides = {}) {
  const subscriber = {
    subscribe: vi.fn().mockResolvedValue(1),
    unsubscribe: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    off: vi.fn(),
  };

  return createApp({
    db: {
      execute: overrides.dbExecute ?? vi.fn().mockResolvedValue([{ ok: 1 }]),
    } as never,
    redis: {
      ping: overrides.redisPing ?? vi.fn().mockResolvedValue("PONG"),
    } as never,
    subscriber: subscriber as never,
    queues: {
      botExecutionQueue: { name: "bot-execution" },
      backtestQueue: { name: "backtest" },
      dataExportQueue: { name: "data-export", getJobCounts: vi.fn().mockResolvedValue({}) },
      close: async () => undefined,
    } as never,
    exchangeManager: {} as never,
    marketData: {
      close: vi.fn().mockResolvedValue(undefined),
      getSymbols: vi.fn().mockResolvedValue(["BTC/USDT"]),
      getQualityMetrics: vi.fn().mockResolvedValue([
        {
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "15m",
          totalCandles: 100,
          gapCount: 0,
          earliest: "2026-05-30T00:00:00.000Z",
          latest: "2026-05-30T10:00:00.000Z",
          startTime: "2026-05-30T00:00:00.000Z",
          nextStartTime: "2026-05-30T10:15:00.000Z",
          latestAvailableTime: "2026-05-30T10:00:00.000Z",
          latestCandleAgeMs: 60_000,
          websocketStatus: "external",
          restFallbackCount: 0,
          validationFailures: 0,
          apiErrors: 0,
          repairFailures: 0,
          backfillBacklog: 0,
          candlesInserted: 100,
          missingCandles: 0,
          completenessPct: "100.00",
          lastUpdated: "2026-05-30T10:01:00.000Z",
          status: "complete",
        },
      ]),
    } as never,
    keyVault: new KeyVault("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
    exportsDir: "/tmp/exports",
    enableBullBoard: false,
    loggerOptions: false,
  });
}

describe("createApp", () => {
  const apps: Array<Awaited<ReturnType<typeof createApp>>> = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("serves the health endpoint with CORS headers", async () => {
    const app = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      status: string;
      db: string;
      redis: string;
      uptime: number;
      version: string;
    };
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(body.redis).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("does not require an auth bearer token on /health", async () => {
    const app = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/health",
      // intentionally no authorization header
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
  });

  it("returns 503 degraded when the database ping fails", async () => {
    const app = await createTestApp({
      dbExecute: vi.fn().mockRejectedValue(new Error("connection refused")),
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    const body = response.json() as {
      status: string;
      db: string;
      redis: string;
      error?: string;
    };
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("error");
    expect(body.redis).toBe("ok");
    expect(body.error).toContain("connection refused");
  });

  it("returns 503 degraded when the redis ping fails", async () => {
    const app = await createTestApp({
      redisPing: vi.fn().mockRejectedValue(new Error("redis down")),
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    const body = response.json() as {
      status: string;
      db: string;
      redis: string;
      error?: string;
    };
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("ok");
    expect(body.redis).toBe("error");
    expect(body.error).toContain("redis down");
  });

  it("returns 503 degraded when both db and redis fail", async () => {
    const app = await createTestApp({
      dbExecute: vi.fn().mockRejectedValue(new Error("db gone")),
      redisPing: vi.fn().mockRejectedValue(new Error("redis gone")),
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    const body = response.json() as {
      status: string;
      db: string;
      redis: string;
      error?: string;
    };
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("error");
    expect(body.redis).toBe("error");
    expect(body.error).toContain("db gone");
    expect(body.error).toContain("redis gone");
  });

  it("accepts long batched tRPC market-data paths", async () => {
    const previousAppMode = process.env["APP_MODE"];
    process.env["APP_MODE"] = "testing";
    const app = await createTestApp();
    apps.push(app);

    const path =
      "/trpc/market.getSymbols,dataCollection.getQualityMetrics,research.getDataReadiness,dataCollection.queueStats";
    const input = encodeURIComponent(
      JSON.stringify({
        0: { exchange: "binance", collectedOnly: true },
        1: {},
        2: { exchange: "binance" },
      })
    );

    try {
      const response = await app.inject({
        method: "GET",
        url: `${path}?batch=1&input=${input}`,
      });

      expect(path.replace("/trpc/", "").length).toBeGreaterThan(100);
      expect(response.statusCode).toBe(200);
    } finally {
      if (previousAppMode === undefined) {
        delete process.env["APP_MODE"];
      } else {
        process.env["APP_MODE"] = previousAppMode;
      }
    }
  });
});
