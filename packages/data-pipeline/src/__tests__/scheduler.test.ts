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
    };

    await setupRepeatableJobs(
      queue as never,
      ["BTC/USDT"],
      ["binance"],
      ["1m", "5m", "15m", "1h", "4h", "1d"]
    );

    expect(jobs.map((job) => job.data.timeframe)).toEqual(["1m", "5m", "15m", "1h", "4h", "1d"]);
    expect(jobs.map((job) => job.opts.repeat.every)).toEqual([
      60_000, 300_000, 900_000, 3_600_000, 14_400_000, 86_400_000,
    ]);
    expect(jobs[0]?.name).toBe(JOB_NAMES.COLLECT_OHLCV_1M);
    expect(jobs.at(-1)?.name).toBe(JOB_NAMES.COLLECT_OHLCV_DAILY);
  });
});
