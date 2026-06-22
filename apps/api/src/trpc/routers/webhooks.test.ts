import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTrpcContext } from "../context";
import { createCaller } from "../router";

const deliverWebhook = vi.fn().mockResolvedValue(undefined);
vi.mock("../../services/webhookDelivery", () => ({
  deliverWebhook: (...args: unknown[]) => deliverWebhook(...args),
}));

function createQueryBuilder<T>(rows: T[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (value: T[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return builder;
}

function caller(db: unknown) {
  return createCaller(
    createTrpcContext(
      {
        db: db as never,
        redis: {} as never,
        queues: {} as never,
        exchangeManager: {} as never,
        marketData: {} as never,
        keyVault: {} as never,
        exportsDir: "/tmp/exports",
      },
      { headers: { authorization: "Bearer test-token" } } as never
    )
  );
}

const UUID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.stubEnv("API_AUTH_TOKEN", "test-token");
  deliverWebhook.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("webhooks router", () => {
  it("list returns stored webhooks", async () => {
    const rows = [{ id: UUID, url: "https://example.com/hook", events: ["bot.error"] }];
    const db = { select: () => createQueryBuilder(rows) };
    expect(await caller(db).webhooks.list()).toEqual(rows);
  });

  it("create inserts and returns the new webhook", async () => {
    const row = { id: UUID, url: "https://example.com/hook", events: ["bot.error"], secret: null };
    const returning = vi.fn().mockResolvedValue([row]);
    const db = { insert: vi.fn(() => ({ values: vi.fn(() => ({ returning })) })) };

    const result = await caller(db).webhooks.create({
      url: "https://example.com/hook",
      events: ["bot.error"],
    });

    expect(result).toEqual(row);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("delete returns NOT_FOUND when no row is removed", async () => {
    const db = {
      delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    };
    await expect(caller(db).webhooks.delete({ id: UUID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("test delivers a test event for an existing webhook", async () => {
    const db = {
      select: () => createQueryBuilder([{ id: UUID, url: "https://example.com/hook" }]),
    };

    const result = await caller(db).webhooks.test({ id: UUID });

    expect(result).toEqual({ success: true });
    expect(deliverWebhook).toHaveBeenCalledWith(expect.anything(), "webhook.test", {
      webhookId: UUID,
    });
  });

  it("test returns NOT_FOUND for an unknown webhook", async () => {
    const db = { select: () => createQueryBuilder([]) };
    await expect(caller(db).webhooks.test({ id: UUID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(deliverWebhook).not.toHaveBeenCalled();
  });

  it("requires a valid auth token", async () => {
    vi.stubEnv("API_AUTH_TOKEN", "a-different-token");
    const db = { select: () => createQueryBuilder([]) };
    await expect(caller(db).webhooks.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
