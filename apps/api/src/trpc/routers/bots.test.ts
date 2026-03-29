import { describe, expect, it, vi } from "vitest";

import { createTrpcContext } from "../context.js";
import { createCaller } from "../router.js";

function createQueryBuilder<T>(rows: T[]) {
  const state = {
    offset: 0,
    limit: undefined as number | undefined,
  };

  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    groupBy: () => builder,
    limit: (value: number) => {
      state.limit = value;
      return builder;
    },
    offset: (value: number) => {
      state.offset = value;
      return builder;
    },
    then: (resolve: (value: T[]) => unknown, reject?: (reason: unknown) => unknown) => {
      const start = state.offset;
      const end = state.limit == null ? undefined : start + state.limit;
      return Promise.resolve(rows.slice(start, end)).then(resolve, reject);
    },
  };

  return builder;
}

function createDbMock(selectRows: unknown[][]) {
  const select = vi.fn(() => createQueryBuilder(selectRows.shift() ?? []));
  const updateWhere = vi.fn().mockResolvedValue(undefined);

  return {
    select,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: updateWhere,
      })),
    })),
  };
}

describe("bots router", () => {
  it("dispatches a start job and publishes a status update", async () => {
    const db = createDbMock([
      [
        {
          id: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e",
          name: "Momentum Bot",
          strategy: "sma-crossover",
          strategyParams: {},
          exchange: "binance",
          symbol: "BTC/USDT",
          timeframe: "1h",
          mode: "paper",
          status: "idle",
          riskConfig: {},
          currentBalance: "10000",
          totalPnl: "0",
          totalTrades: "0",
          winRate: "0",
          errorMessage: null,
          startedAt: null,
          stoppedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    ]);
    const add = vi.fn().mockResolvedValue({ id: "job-1" });
    const publish = vi.fn().mockResolvedValue(1);

    const caller = createCaller(
      createTrpcContext({
        db: db as never,
        redis: { publish } as never,
        queues: {
          botExecutionQueue: { add },
          backtestQueue: {},
          dataCollectionQueue: {},
          dataBackfillQueue: {},
          dataExportQueue: {},
          close: async () => undefined,
        } as never,
        exchangeManager: {} as never,
        keyVault: {} as never,
        exportsDir: "/tmp/exports",
      })
    );

    const result = await caller.bots.start({ botId: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e" });

    expect(result).toEqual({ success: true, jobId: "job-1" });
    expect(add).toHaveBeenCalledWith(
      "start-bot",
      { botId: "d5d64559-5a73-4389-bc6a-1ac9e8a67c2e" },
      expect.objectContaining({ jobId: "bot-d5d64559-5a73-4389-bc6a-1ac9e8a67c2e-start" })
    );
    expect(publish).toHaveBeenCalledWith("bot:status", expect.stringContaining("starting"));
  });
});
