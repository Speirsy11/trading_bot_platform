import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateAndPrintEnv } from "./envValidation";

// Required vars that must be set for a passing validation
const REQUIRED_VARS: Record<string, string> = {
  DATABASE_URL: "postgres://user:pass@localhost/db",
  ENCRYPTION_KEY: "a".repeat(32),
  API_AUTH_TOKEN: "test-token",
};

describe("validateAndPrintEnv", () => {
  beforeEach(() => {
    // Suppress console output during tests
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not throw when all required vars are set", () => {
    for (const [key, value] of Object.entries(REQUIRED_VARS)) {
      vi.stubEnv(key, value);
    }

    expect(() => validateAndPrintEnv()).not.toThrow();
  });

  it("prints a table to console.info", () => {
    for (const [key, value] of Object.entries(REQUIRED_VARS)) {
      vi.stubEnv(key, value);
    }

    validateAndPrintEnv();

    // console.info should have been called at least once
    expect(vi.mocked(console.info)).toHaveBeenCalled();

    // The table should contain column headers
    const calls = vi.mocked(console.info).mock.calls.flat().join("\n");
    expect(calls).toContain("Variable");
    expect(calls).toContain("Status");
    expect(calls).toContain("Value");
  });

  it("shows SET for a provided required var and redacts its value", () => {
    for (const [key, value] of Object.entries(REQUIRED_VARS)) {
      vi.stubEnv(key, value);
    }

    validateAndPrintEnv();

    const calls = vi.mocked(console.info).mock.calls.flat().join("\n");
    expect(calls).toContain("DATABASE_URL");
    expect(calls).toContain("SET");
    // Redacted secrets must not appear in output
    expect(calls).not.toContain("postgres://");
    expect(calls).toContain("***");
  });

  it("shows DEFAULT for optional vars that use their default value", () => {
    for (const [key, value] of Object.entries(REQUIRED_VARS)) {
      vi.stubEnv(key, value);
    }
    // Ensure REDIS_URL is not set so default kicks in
    vi.stubEnv("REDIS_URL", "");

    validateAndPrintEnv();

    const calls = vi.mocked(console.info).mock.calls.flat().join("\n");
    expect(calls).toContain("DEFAULT");
    expect(calls).toContain("redis://127.0.0.1:6379");
  });

  it("throws when DATABASE_URL is missing", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ENCRYPTION_KEY", REQUIRED_VARS["ENCRYPTION_KEY"]!);
    vi.stubEnv("API_AUTH_TOKEN", REQUIRED_VARS["API_AUTH_TOKEN"]!);

    expect(() => validateAndPrintEnv()).toThrow(/DATABASE_URL/);
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    vi.stubEnv("DATABASE_URL", REQUIRED_VARS["DATABASE_URL"]!);
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("API_AUTH_TOKEN", REQUIRED_VARS["API_AUTH_TOKEN"]!);

    expect(() => validateAndPrintEnv()).toThrow(/ENCRYPTION_KEY/);
  });

  it("throws when API_AUTH_TOKEN is missing", () => {
    vi.stubEnv("DATABASE_URL", REQUIRED_VARS["DATABASE_URL"]!);
    vi.stubEnv("ENCRYPTION_KEY", REQUIRED_VARS["ENCRYPTION_KEY"]!);
    vi.stubEnv("API_AUTH_TOKEN", "");

    expect(() => validateAndPrintEnv()).toThrow(/API_AUTH_TOKEN/);
  });

  it("throws listing all missing required vars when multiple are absent", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("API_AUTH_TOKEN", "");

    expect(() => validateAndPrintEnv()).toThrow(/DATABASE_URL.*ENCRYPTION_KEY.*API_AUTH_TOKEN/);
  });

  it("includes MISSING status in table output when a required var is absent", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ENCRYPTION_KEY", REQUIRED_VARS["ENCRYPTION_KEY"]!);
    vi.stubEnv("API_AUTH_TOKEN", REQUIRED_VARS["API_AUTH_TOKEN"]!);

    try {
      validateAndPrintEnv();
    } catch {
      // expected
    }

    const calls = vi.mocked(console.info).mock.calls.flat().join("\n");
    expect(calls).toContain("MISSING");
    expect(calls).toContain("(required)");
  });
});
