import { describe, expect, it } from "vitest";

import { parseAllowedOrigins } from "./cors";

describe("parseAllowedOrigins", () => {
  describe("when CORS_ORIGINS is set", () => {
    it("returns a single origin", () => {
      expect(parseAllowedOrigins("https://app.example.com", "production")).toEqual([
        "https://app.example.com",
      ]);
    });

    it("splits multiple comma-separated origins", () => {
      expect(
        parseAllowedOrigins("http://localhost:3000,https://app.example.com", "production")
      ).toEqual(["http://localhost:3000", "https://app.example.com"]);
    });

    it("trims whitespace around each origin", () => {
      expect(
        parseAllowedOrigins("  http://localhost:3000 , https://app.example.com  ", "development")
      ).toEqual(["http://localhost:3000", "https://app.example.com"]);
    });

    it("filters out empty entries from trailing commas", () => {
      expect(parseAllowedOrigins("http://localhost:3000,", "development")).toEqual([
        "http://localhost:3000",
      ]);
    });
  });

  describe("when CORS_ORIGINS is not set", () => {
    it("throws in production", () => {
      expect(() => parseAllowedOrigins(undefined, "production")).toThrow(
        "CORS_ORIGINS must be set in production"
      );
    });

    it("throws in production when value is empty string", () => {
      expect(() => parseAllowedOrigins("", "production")).toThrow(
        "CORS_ORIGINS must be set in production"
      );
    });

    it("throws in production when value is whitespace only", () => {
      expect(() => parseAllowedOrigins("   ", "production")).toThrow(
        "CORS_ORIGINS must be set in production"
      );
    });

    it("falls back to localhost defaults in development", () => {
      expect(parseAllowedOrigins(undefined, "development")).toEqual([
        "http://localhost:3000",
        "http://localhost:3001",
      ]);
    });

    it("falls back to localhost defaults in test", () => {
      expect(parseAllowedOrigins(undefined, "test")).toEqual([
        "http://localhost:3000",
        "http://localhost:3001",
      ]);
    });

    it("falls back to localhost defaults when NODE_ENV is undefined", () => {
      expect(parseAllowedOrigins(undefined, undefined)).toEqual([
        "http://localhost:3000",
        "http://localhost:3001",
      ]);
    });
  });
});
