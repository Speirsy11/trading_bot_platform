import { TRPCError } from "@trpc/server";

export enum AppErrorCode {
  EXCHANGE_CONNECTION_FAILED = "EXCHANGE_CONNECTION_FAILED",
  EXCHANGE_RATE_LIMITED = "EXCHANGE_RATE_LIMITED",
  EXCHANGE_INSUFFICIENT_FUNDS = "EXCHANGE_INSUFFICIENT_FUNDS",
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
  const lower = message.toLowerCase();

  if (lower.includes("rate limit")) {
    return new AppError(AppErrorCode.EXCHANGE_RATE_LIMITED, message, 429, error);
  }

  if (lower.includes("insufficient") || lower.includes("balance")) {
    return new AppError(AppErrorCode.EXCHANGE_INSUFFICIENT_FUNDS, message, 400, error);
  }

  return new AppError(AppErrorCode.EXCHANGE_CONNECTION_FAILED, message, 502, error);
}

export function toTrpcError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof AppError) {
    const code =
      error.statusCode === 404
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
      cause: { appCode: error.appCode },
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: error instanceof Error ? error.message : "Unexpected error",
    cause: error,
  });
}
