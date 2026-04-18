import { describe, expect, it, vi } from "vitest";

import { assertDatabaseSchemaReady } from "./databaseSchema";

describe("assertDatabaseSchemaReady", () => {
  it("returns when the required tables exist", async () => {
    const client = {
      unsafe: vi.fn().mockResolvedValue([]),
    };

    await expect(assertDatabaseSchemaReady(client as never)).resolves.toBeUndefined();
    expect(client.unsafe).toHaveBeenCalledOnce();
  });

  it("throws a helpful error when required tables are missing", async () => {
    const client = {
      unsafe: vi.fn().mockResolvedValue([{ relation_name: "order_audit_log" }]),
    };

    await expect(assertDatabaseSchemaReady(client as never)).rejects.toThrow(
      "Database schema is not initialized; missing table: order_audit_log. Run `pnpm db:migrate` and restart the service."
    );
  });
});
