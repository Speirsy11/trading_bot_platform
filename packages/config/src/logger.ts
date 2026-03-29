import pino from "pino";

export function createLogger(name: string) {
  return pino({
    name,
    level: process.env["LOG_LEVEL"] || "info",
    redact: ["apiKey", "apiSecret", "secret", "password", "*.apiKey", "*.apiSecret"],
    transport:
      process.env["NODE_ENV"] === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}
