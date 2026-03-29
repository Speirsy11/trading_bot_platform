import { createLogger } from "@tb/config";
import type { Candle } from "@tb/types";

import { CandleValidator } from "../validation/CandleValidator.js";

const logger = createLogger("stream-processor");

export class StreamProcessor {
  private validator: CandleValidator;

  constructor() {
    this.validator = new CandleValidator();
  }

  processRawKline(raw: unknown[]): Candle | null {
    if (!Array.isArray(raw) || raw.length < 6) {
      logger.warn({ raw }, "Invalid raw kline format");
      return null;
    }

    const candle: Candle = {
      time: Number(raw[0]),
      open: Number(raw[1]),
      high: Number(raw[2]),
      low: Number(raw[3]),
      close: Number(raw[4]),
      volume: Number(raw[5]),
    };

    const result = this.validator.validate(candle);
    if (!result.valid) {
      logger.warn({ candle, errors: result.errors }, "Invalid candle from stream");
      return null;
    }

    return candle;
  }

  normalizeTimestamp(timestamp: number): number {
    // Ensure UTC milliseconds
    return new Date(timestamp).getTime();
  }
}
