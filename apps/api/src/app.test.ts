import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";
import { KeyVault } from "./services/keyVault";

describe("createApp", () => {
  const apps: Array<Awaited<ReturnType<typeof createApp>>> = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it("serves the health endpoint with CORS headers", async () => {
    const subscriber = {
      subscribe: vi.fn().mockResolvedValue(1),
      unsubscribe: vi.fn().mockResolvedValue(1),
      on: vi.fn(),
      off: vi.fn(),
    };

    const app = await createApp({
      db: { execute: vi.fn().mockResolvedValue([{ ok: 1 }]) } as never,
      redis: { ping: vi.fn().mockResolvedValue("PONG") } as never,
      subscriber: subscriber as never,
      queues: {
        botExecutionQueue: { name: "bot-execution" },
        backtestQueue: { name: "backtest" },
        dataCollectionQueue: { name: "data-collection" },
        dataBackfillQueue: { name: "data-backfill" },
        dataExportQueue: { name: "data-export" },
        close: async () => undefined,
      } as never,
      exchangeManager: {} as never,
      keyVault: new KeyVault("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
      exportsDir: "/tmp/exports",
      enableBullBoard: false,
      loggerOptions: false,
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});
