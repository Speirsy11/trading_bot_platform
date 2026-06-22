import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTrpcContext } from "../context";
import { createCaller } from "../router";

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

function caller(overrides: Record<string, unknown>) {
  return createCaller(
    createTrpcContext(
      {
        db: {} as never,
        redis: {} as never,
        queues: {} as never,
        exchangeManager: {} as never,
        marketData: {} as never,
        keyVault: {} as never,
        exportsDir: "/tmp/exports",
        ...overrides,
      } as never,
      { headers: { authorization: "Bearer test-token" } } as never
    )
  );
}

const UUID = "22222222-2222-2222-2222-222222222222";

function exchangeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    exchange: "binance",
    apiKey: "enc-key",
    apiSecret: "enc-secret",
    sandbox: false,
    enabled: true,
    metadata: JSON.stringify({ name: "My Binance" }),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

const keyVault = { encrypt: vi.fn((value: string) => `enc(${value})`) };

beforeEach(() => {
  vi.stubEnv("API_AUTH_TOKEN", "test-token");
  vi.stubEnv("APP_MODE", "testing");
  keyVault.encrypt.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("exchanges router", () => {
  it("list serializes stored exchange configs and hides secrets", async () => {
    const db = { select: () => createQueryBuilder([exchangeRow()]) };

    const result = await caller({ db }).exchanges.list();

    expect(result).toEqual([
      {
        id: UUID,
        exchange: "binance",
        name: "My Binance",
        enabled: true,
        testnet: false,
        hasCredentials: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("add encrypts credentials and returns the serialized config", async () => {
    const returning = vi.fn().mockResolvedValue([exchangeRow()]);
    const db = { insert: vi.fn(() => ({ values: vi.fn(() => ({ returning })) })) };

    const result = await caller({ db, keyVault }).exchanges.add({
      exchange: "binance",
      name: "My Binance",
      apiKey: "raw-key",
      apiSecret: "raw-secret",
      testnet: false,
    });

    expect(keyVault.encrypt).toHaveBeenCalledWith("raw-key");
    expect(keyVault.encrypt).toHaveBeenCalledWith("raw-secret");
    expect(result).toMatchObject({ exchange: "binance", name: "My Binance", hasCredentials: true });
  });

  it("add maps a unique-violation to CONFLICT", async () => {
    const returning = vi.fn().mockRejectedValue({ code: "23505" });
    const db = { insert: vi.fn(() => ({ values: vi.fn(() => ({ returning })) })) };

    await expect(
      caller({ db, keyVault }).exchanges.add({
        exchange: "binance",
        name: "Dup",
        apiKey: "k",
        apiSecret: "s",
        testnet: false,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("testConnection short-circuits to a simulated success in testing mode", async () => {
    const exchangeManager = { testConnection: vi.fn() };

    const result = await caller({ exchangeManager }).exchanges.testConnection({ exchangeId: UUID });

    expect(result).toEqual({ success: true, exchangeId: UUID, simulated: true });
    expect(exchangeManager.testConnection).not.toHaveBeenCalled();
  });

  it("remove soft-deletes and clears the manager cache", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const db = { update: vi.fn(() => ({ set: vi.fn(() => ({ where })) })) };
    const exchangeManager = { clearCache: vi.fn() };

    const result = await caller({ db, exchangeManager }).exchanges.remove({ exchangeId: UUID });

    expect(result).toEqual({ success: true });
    expect(exchangeManager.clearCache).toHaveBeenCalledWith(UUID);
  });

  it("update returns NOT_FOUND when the config does not exist", async () => {
    const db = { select: () => createQueryBuilder([]) };
    const exchangeManager = { clearCache: vi.fn() };

    await expect(
      caller({ db, exchangeManager }).exchanges.update({ exchangeId: UUID, name: "New" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("update renames an existing config", async () => {
    const returning = vi
      .fn()
      .mockResolvedValue([exchangeRow({ metadata: JSON.stringify({ name: "Renamed" }) })]);
    const db = {
      select: () => createQueryBuilder([exchangeRow()]),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning })) })) })),
    };
    const exchangeManager = { clearCache: vi.fn() };

    const result = await caller({ db, exchangeManager }).exchanges.update({
      exchangeId: UUID,
      name: "Renamed",
    });

    expect(result).toMatchObject({ name: "Renamed" });
    expect(exchangeManager.clearCache).toHaveBeenCalledWith(UUID);
  });
});
