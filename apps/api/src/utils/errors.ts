import { TRPCError } from "@trpc/server";
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

export enum AppErrorCode {
  EXCHANGE_CONNECTION_FAILED = "EXCHANGE_CONNECTION_FAILED",
  EXCHANGE_RATE_LIMITED = "EXCHANGE_RATE_LIMITED",
  EXCHANGE_INSUFFICIENT_FUNDS = "EXCHANGE_INSUFFICIENT_FUNDS",
  EXCHANGE_INVALID_ORDER = "EXCHANGE_INVALID_ORDER",
  EXCHANGE_ORDER_NOT_FOUND = "EXCHANGE_ORDER_NOT_FOUND",
  EXCHANGE_NETWORK_ERROR = "EXCHANGE_NETWORK_ERROR",
  EXCHANGE_AUTH_FAILED = "EXCHANGE_AUTH_FAILED",
  EXCHANGE_MAINTENANCE = "EXCHANGE_MAINTENANCE",
  EXCHANGE_UNKNOWN = "EXCHANGE_UNKNOWN",
  BOT_ALREADY_RUNNING = "BOT_ALREADY_RUNNING",
  BOT_NOT_FOUND = "BOT_NOT_FOUND",
  INVALID_STRATEGY = "INVALID_STRATEGY",
  BACKTEST_DATA_UNAVAILABLE = "BACKTEST_DATA_UNAVAILABLE",
  ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
}

export class AppError extends Error {
  readonly appCode: AppErrorCode;
  readonly statusCode: number;

  constructor(appCode: AppErrorCode, message: string, statusCode = 400, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = "AppError";
    this.appCode = appCode;
    this.statusCode = statusCode;
  }
}

export function mapExchangeError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof InsufficientFunds) {
    return new AppError(AppErrorCode.EXCHANGE_INSUFFICIENT_FUNDS, message, 400, error);
  }

  // OrderNotFound extends InvalidOrder — check the subclass first.
  if (error instanceof OrderNotFound) {
    return new AppError(AppErrorCode.EXCHANGE_ORDER_NOT_FOUND, message, 404, error);
  }

  if (error instanceof InvalidOrder) {
    return new AppError(AppErrorCode.EXCHANGE_INVALID_ORDER, message, 400, error);
  }

  if (error instanceof RateLimitExceeded) {
    return new AppError(AppErrorCode.EXCHANGE_RATE_LIMITED, message, 429, error);
  }

  if (error instanceof AuthenticationError) {
    return new AppError(AppErrorCode.EXCHANGE_AUTH_FAILED, message, 401, error);
  }

  if (error instanceof OnMaintenance) {
    return new AppError(AppErrorCode.EXCHANGE_MAINTENANCE, message, 503, error);
  }

  // NetworkError is a base class for DDoSProtection, RateLimitExceeded, etc.
  // Check it after the more specific subclasses above.
  if (error instanceof NetworkError) {
    return new AppError(AppErrorCode.EXCHANGE_NETWORK_ERROR, message, 502, error);
  }

  // ExchangeError is the base class for most CCXT errors — check last.
  if (error instanceof ExchangeError) {
    return new AppError(AppErrorCode.EXCHANGE_UNKNOWN, message, 502, error);
  }

  return new AppError(AppErrorCode.EXCHANGE_UNKNOWN, message, 502, error);
}

export function toTrpcError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof AppError) {
    const code =
      error.statusCode === 401
        ? "UNAUTHORIZED"
        : error.statusCode === 403
          ? "FORBIDDEN"
          : error.statusCode === 404
            ? "NOT_FOUND"
            : error.statusCode === 409
              ? "CONFLICT"
              : error.statusCode === 429
                ? "TOO_MANY_REQUESTS"
                : error.statusCode >= 500
                  ? "BAD_GATEWAY"
                  : "BAD_REQUEST";

    return new TRPCError({
      code,
      message: error.message,
      cause: { appCode: error.appCode, originalCause: error.cause ?? null },
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: error instanceof Error ? error.message : "Unexpected error",
    cause: error,
  });
}
