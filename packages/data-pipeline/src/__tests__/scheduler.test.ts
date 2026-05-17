import { describe, expect, it } from "vitest";

import { setupRepeatableJobs } from "../jobs/scheduler";
import { JOB_NAMES } from "../jobs/types";

describe("setupRepeatableJobs", () => {
  it("schedules every configured timeframe", async () => {
    const jobs: Array<{
      name: string;
      data: { timeframe: string };
      opts: { repeat: { every: number }; jobId: string };
    }> = [];
    const queue = {
      add: async (
        name: string,
        data: { timeframe: string },
        opts: { repeat: { every: number }; jobId: string }
      ) => {
        jobs.push({ name, data, opts });
      },
      getRepeatableJobs: async () => [],
      removeRepeatableByKey: async () => undefined,
    };

    await setupRepeatableJobs(
      queue as never,
      ["BTC/USDT"],
      ["binance"],
      ["1m", "5m", "15m", "1h", "4h", "1d"]
    );

    const collectionJobs = jobs.filter((job) => job.name !== JOB_NAMES.REPAIR_RECENT);
    const repairJobs = jobs.filter((job) => job.name === JOB_NAMES.REPAIR_RECENT);

    expect(collectionJobs.map((job) => job.data.timeframe)).toEqual([
      "1m",
      "5m",
      "15m",
      "1h",
      "4h",
      "1d",
    ]);
    expect(collectionJobs.map((job) => job.opts.repeat.every)).toEqual([
      60_000, 300_000, 900_000, 3_600_000, 14_400_000, 86_400_000,
    ]);
    expect(repairJobs).toHaveLength(6);
    expect(collectionJobs[0]?.name).toBe(JOB_NAMES.COLLECT_OHLCV_1M);
    expect(collectionJobs.at(-1)?.name).toBe(JOB_NAMES.COLLECT_OHLCV_DAILY);
  });
});
