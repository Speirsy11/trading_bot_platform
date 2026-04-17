import {
  AuthenticationError,
  ExchangeError,
  InsufficientFunds,
  InvalidOrder,
  NetworkError,
  OnMaintenance,
  OrderNotFound,
  RateLimitExceeded,
} from "ccxt";
import { describe, expect, it } from "vitest";

import { AppError, AppErrorCode, mapExchangeError } from "./errors";

describe("mapExchangeError", () => {
  it("returns an AppError instance for every input", () => {
    expect(mapExchangeError(new Error("generic"))).toBeInstanceOf(AppError);
  });

  it("maps InsufficientFunds → EXCHANGE_INSUFFICIENT_FUNDS with status 400", () => {
    const err = mapExchangeError(new InsufficientFunds("not enough BTC"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_INSUFFICIENT_FUNDS);
    expect(err.statusCode).toBe(400);
  });

  it("maps InvalidOrder → EXCHANGE_INVALID_ORDER with status 400", () => {
    const err = mapExchangeError(new InvalidOrder("bad order params"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_INVALID_ORDER);
    expect(err.statusCode).toBe(400);
  });

  it("maps OrderNotFound → EXCHANGE_ORDER_NOT_FOUND with status 404", () => {
    const err = mapExchangeError(new OrderNotFound("order 123 missing"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_ORDER_NOT_FOUND);
    expect(err.statusCode).toBe(404);
  });

  it("maps RateLimitExceeded → EXCHANGE_RATE_LIMITED with status 429", () => {
    const err = mapExchangeError(new RateLimitExceeded("slow down"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_RATE_LIMITED);
    expect(err.statusCode).toBe(429);
  });

  it("maps AuthenticationError → EXCHANGE_AUTH_FAILED with status 401", () => {
    const err = mapExchangeError(new AuthenticationError("invalid key"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_AUTH_FAILED);
    expect(err.statusCode).toBe(401);
  });

  it("maps OnMaintenance → EXCHANGE_MAINTENANCE with status 503", () => {
    const err = mapExchangeError(new OnMaintenance("exchange down"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_MAINTENANCE);
    expect(err.statusCode).toBe(503);
  });

  it("maps NetworkError → EXCHANGE_NETWORK_ERROR with status 502", () => {
    const err = mapExchangeError(new NetworkError("timeout"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_NETWORK_ERROR);
    expect(err.statusCode).toBe(502);
  });

  it("maps base ExchangeError → EXCHANGE_UNKNOWN with status 502", () => {
    const err = mapExchangeError(new ExchangeError("something went wrong"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_UNKNOWN);
    expect(err.statusCode).toBe(502);
  });

  it("maps a plain Error (non-CCXT) → EXCHANGE_UNKNOWN with status 502", () => {
    const err = mapExchangeError(new Error("totally unknown problem"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_UNKNOWN);
    expect(err.statusCode).toBe(502);
  });

  it("maps a thrown string → EXCHANGE_UNKNOWN", () => {
    const err = mapExchangeError("something bad");
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_UNKNOWN);
  });

  it("preserves the original error message", () => {
    const original = new InsufficientFunds("only 0.001 BTC available");
    const err = mapExchangeError(original);
    expect(err.message).toBe("only 0.001 BTC available");
  });

  it("RateLimitExceeded (subclass of NetworkError) maps to EXCHANGE_RATE_LIMITED, not EXCHANGE_NETWORK_ERROR", () => {
    // RateLimitExceeded extends NetworkError in CCXT; our ordering must handle this.
    const err = mapExchangeError(new RateLimitExceeded("too many requests"));
    expect(err.appCode).toBe(AppErrorCode.EXCHANGE_RATE_LIMITED);
  });
});
