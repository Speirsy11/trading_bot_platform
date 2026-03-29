import type { FastifyServerOptions } from "fastify";

export function createFastifyLoggerOptions(): FastifyServerOptions["logger"] {
  return {
    level:
      process.env["LOG_LEVEL"] ?? (process.env["NODE_ENV"] === "development" ? "debug" : "info"),
    redact: {
      paths: [
        "apiKey",
        "apiSecret",
        "secret",
        "password",
        "req.headers.authorization",
        "headers.authorization",
        "body.apiKey",
        "body.apiSecret",
        "body.passphrase",
        "*.apiKey",
        "*.apiSecret",
        "*.passphrase",
      ],
      censor: "[REDACTED]",
    },
    transport:
      process.env["NODE_ENV"] === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
  };
}
