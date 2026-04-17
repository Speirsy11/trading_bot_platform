import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";
import { KeyVault } from "./services/keyVault";

// ---------- minimal DB mock helpers ----------

type AnyRecord = Record<string, unknown>;

/** Builds a chainable select builder that resolves to `rows`. */
function makeSelectBuilder(rows: AnyRecord[]) {
  const b: AnyRecord = {};
  const chain = () => b;
  b["from"] = chain;
  b["where"] = chain;
  b["orderBy"] = chain;
  b["limit"] = chain;
  b["then"] = (resolve: (v: AnyRecord[]) => unknown) => Promise.resolve(rows).then(resolve);
  return b;
}

/** Builds a chainable update builder whose `.where()` resolves. */
function makeUpdateBuilder() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn(() => ({ where }));
  return { update: vi.fn(() => ({ set })), _where: where };
}

// ---------- test app factory ----------

interface TestAppOptions {
  /** The rows returned for the initial "live bots" select query. */
  liveBots?: AnyRecord[];
  /**
   * The row(s) returned for each per-bot exchange-config select query.
   * Pass a single object (reused for every bot) or an array of arrays
   * (one inner array per bot, consumed in order).
   */
  exchangeConfigRows?: AnyRecord | AnyRecord[] | Array<AnyRecord[]>;
  openOrders?: AnyRecord[];
  cancelOrderImpl?: () => Promise<AnyRecord>;
  fetchOpenOrdersImpl?: () => Promise<AnyRecord[]>;
  publishImpl?: () => Promise<number>;
}

async function createTestApp(opts: TestAppOptions = {}) {
  const liveBots = opts.liveBots ?? [];

  /**
   * Build the per-bot exchange-config rows.
   * Normalise to Array<AnyRecord[]>: one inner array per bot call.
   */
  const rawConfigRows = opts.exchangeConfigRows;
  let perBotConfigRows: Array<AnyRecord[]>;
  if (!rawConfigRows) {
    perBotConfigRows = liveBots.map(() => []);
  } else if (Array.isArray(rawConfigRows)) {
    if (rawConfigRows.length === 0 || !Array.isArray(rawConfigRows[0])) {
      // Flat array: treat as a single result set, reuse for every bot
      perBotConfigRows = liveBots.map(() => rawConfigRows as AnyRecord[]);
    } else {
      // Already Array<AnyRecord[]>
      perBotConfigRows = rawConfigRows as Array<AnyRecord[]>;
    }
  } else {
    // Single object: wrap in array, reuse for every bot
    perBotConfigRows = liveBots.map(() => [rawConfigRows]);
  }

  // select() is called: (1) once for live bots, then (2) once per bot for exchange config
  const selectCallQueue = [
    makeSelectBuilder(liveBots),
    ...perBotConfigRows.map((rows) => makeSelectBuilder(rows)),
  ];

  const selectFn = vi.fn(() => selectCallQueue.shift() ?? makeSelectBuilder([]));
  const { update, _where: updateWhere } = makeUpdateBuilder();

  const db = { select: selectFn, update } as never;

  const publish = opts.publishImpl ? vi.fn(opts.publishImpl) : vi.fn().mockResolvedValue(1);

  const fetchOpenOrders = opts.fetchOpenOrdersImpl
    ? vi.fn(opts.fetchOpenOrdersImpl)
    : vi.fn().mockResolvedValue(opts.openOrders ?? []);

  const cancelOrder = opts.cancelOrderImpl
    ? vi.fn(opts.cancelOrderImpl)
    : vi.fn().mockResolvedValue({ success: true });

  const subscriber = {
    subscribe: vi.fn().mockResolvedValue(1),
    unsubscribe: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    off: vi.fn(),
  };

  const app = await createApp({
    db,
    redis: { ping: vi.fn().mockResolvedValue("PONG"), publish } as never,
    subscriber: subscriber as never,
    queues: {
      botExecutionQueue: { name: "bot-execution" },
      backtestQueue: { name: "backtest" },
      dataCollectionQueue: { name: "data-collection" },
      dataBackfillQueue: { name: "data-backfill" },
      dataExportQueue: { name: "data-export" },
      close: async () => undefined,
    } as never,
    exchangeManager: { fetchOpenOrders, cancelOrder } as never,
    keyVault: new KeyVault("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
    exportsDir: "/tmp/exports",
    enableBullBoard: false,
    loggerOptions: false,
  });

  return { app, publish, fetchOpenOrders, cancelOrder, updateWhere };
}

// ---------- helper to manage env token ----------

function withAuthToken(token: string, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const previous = process.env["API_AUTH_TOKEN"];
    process.env["API_AUTH_TOKEN"] = token;
    try {
      await fn();
    } finally {
      if (previous === undefined) {
        delete process.env["API_AUTH_TOKEN"];
      } else {
        process.env["API_AUTH_TOKEN"] = previous;
      }
    }
  };
}

// ---------- tests ----------

describe("POST /emergency-stop", () => {
  const cleanup: Array<Awaited<ReturnType<typeof createApp>>> = [];

  afterEach(async () => {
    await Promise.all(cleanup.map((a) => a.close()));
    cleanup.length = 0;
  });

  it(
    "returns 401 when no auth token is provided",
    withAuthToken("secret", async () => {
      const { app } = await createTestApp();
      cleanup.push(app);

      const response = await app.inject({ method: "POST", url: "/emergency-stop" });
      expect(response.statusCode).toBe(401);
    })
  );

  it(
    "returns 401 when the wrong bearer token is provided",
    withAuthToken("correct-secret", async () => {
      const { app } = await createTestApp();
      cleanup.push(app);

      const response = await app.inject({
        method: "POST",
        url: "/emergency-stop",
        headers: { authorization: "Bearer wrong-token" },
      });
      expect(response.statusCode).toBe(401);
    })
  );

  it(
    "returns { stoppedBots: 0, cancelledOrders: 0, errors: [] } when no live bots are running",
    withAuthToken("secret", async () => {
      const { app } = await createTestApp({ liveBots: [] });
      cleanup.push(app);

      const response = await app.inject({
        method: "POST",
        url: "/emergency-stop",
        headers: { authorization: "Bearer secret" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ stoppedBots: 0, cancelledOrders: 0, errors: [] });
    })
  );

  it(
    "stops live bots and cancels their open orders",
    withAuthToken("secret", async () => {
      const botA = {
        id: "aaaaaaaa-0000-0000-0000-000000000001",
        name: "Bot A",
        exchange: "binance",
        symbol: "BTC/USDT",
        mode: "live",
        status: "running",
      };
      const botB = {
        id: "bbbbbbbb-0000-0000-0000-000000000002",
        name: "Bot B",
        exchange: "binance",
        symbol: "ETH/USDT",
        mode: "live",
        status: "running",
      };
      const exchangeConfig = { id: "cccccccc-0000-0000-0000-000000000099", exchange: "binance" };

      // exchangeConfigRows is a single object — reused for both bots
      const { app, cancelOrder, fetchOpenOrders, updateWhere } = await createTestApp({
        liveBots: [botA, botB],
        exchangeConfigRows: exchangeConfig,
      });
      cleanup.push(app);

      // First bot has 2 open orders; second bot has 1
      fetchOpenOrders
        .mockResolvedValueOnce([
          { id: "order-1", symbol: "BTC/USDT" },
          { id: "order-2", symbol: "BTC/USDT" },
        ])
        .mockResolvedValueOnce([{ id: "order-3", symbol: "ETH/USDT" }]);

      const response = await app.inject({
        method: "POST",
        url: "/emergency-stop",
        headers: { authorization: "Bearer secret" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        stoppedBots: number;
        cancelledOrders: number;
        errors: string[];
      };
      expect(body.stoppedBots).toBe(2);
      expect(body.cancelledOrders).toBe(3);
      expect(body.errors).toEqual([]);

      // DB update should have been called to set status = "stopped"
      expect(updateWhere).toHaveBeenCalled();

      // cancelOrder called once per open order (3 total)
      expect(cancelOrder).toHaveBeenCalledTimes(3);
    })
  );

  it(
    "returns 200 with errors array when some order cancellations fail",
    withAuthToken("secret", async () => {
      const bot = {
        id: "dddddddd-0000-0000-0000-000000000003",
        name: "Bot D",
        exchange: "kraken",
        symbol: "BTC/USD",
        mode: "live",
        status: "running",
      };
      const exchangeConfig = { id: "eeeeeeee-0000-0000-0000-000000000099", exchange: "kraken" };

      const { app } = await createTestApp({
        liveBots: [bot],
        exchangeConfigRows: exchangeConfig,
        openOrders: [{ id: "fail-order", symbol: "BTC/USD" }],
        cancelOrderImpl: () => Promise.reject(new Error("Exchange timeout")),
      });
      cleanup.push(app);

      const response = await app.inject({
        method: "POST",
        url: "/emergency-stop",
        headers: { authorization: "Bearer secret" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        stoppedBots: number;
        cancelledOrders: number;
        errors: string[];
      };
      expect(body.stoppedBots).toBe(1);
      expect(body.cancelledOrders).toBe(0);
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0]).toContain("Exchange timeout");
    })
  );

  it(
    "accepts authentication via x-api-token header",
    withAuthToken("secret", async () => {
      const { app } = await createTestApp({ liveBots: [] });
      cleanup.push(app);

      const response = await app.inject({
        method: "POST",
        url: "/emergency-stop",
        headers: { "x-api-token": "secret" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ stoppedBots: 0, cancelledOrders: 0, errors: [] });
    })
  );
});
