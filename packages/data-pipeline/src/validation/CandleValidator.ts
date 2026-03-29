import type { Candle, ValidationResult, ValidationIssue } from "@tb/types";

export class CandleValidator {
  validate(candle: Candle): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // Rule 1: high >= low
    if (candle.high < candle.low) {
      errors.push({
        rule: "high_gte_low",
        message: `High (${candle.high}) must be >= Low (${candle.low})`,
        severity: "error",
        candle,
      });
    }

    // Rule 2: open within [low, high]
    if (candle.open < candle.low || candle.open > candle.high) {
      errors.push({
        rule: "open_in_range",
        message: `Open (${candle.open}) must be within [${candle.low}, ${candle.high}]`,
        severity: "error",
        candle,
      });
    }

    // Rule 3: close within [low, high]
    if (candle.close < candle.low || candle.close > candle.high) {
      errors.push({
        rule: "close_in_range",
        message: `Close (${candle.close}) must be within [${candle.low}, ${candle.high}]`,
        severity: "error",
        candle,
      });
    }

    // Rule 4: volume >= 0
    if (candle.volume < 0) {
      errors.push({
        rule: "volume_non_negative",
        message: `Volume (${candle.volume}) cannot be negative`,
        severity: "error",
        candle,
      });
    }

    // Rule 5: time is valid timestamp and in the past
    if (isNaN(candle.time) || candle.time <= 0) {
      errors.push({
        rule: "valid_timestamp",
        message: `Timestamp (${candle.time}) is not a valid positive number`,
        severity: "error",
        candle,
      });
    } else if (candle.time > Date.now() + 60_000) {
      // Allow 1 minute tolerance for clock skew
      errors.push({
        rule: "timestamp_not_future",
        message: `Timestamp (${candle.time}) is in the future`,
        severity: "error",
        candle,
      });
    }

    // Rule 6: all-same values warning (stale data)
    if (
      candle.open === candle.high &&
      candle.high === candle.low &&
      candle.low === candle.close
    ) {
      warnings.push({
        rule: "all_same_values",
        message: "Open, High, Low, Close are all identical — may indicate stale data",
        severity: "warning",
        candle,
      });
    }

    // Rule 7: extreme price change (> 20% in one candle)
    if (candle.high > 0 && candle.low > 0) {
      const changePercent = ((candle.high - candle.low) / candle.low) * 100;
      if (changePercent > 20) {
        warnings.push({
          rule: "extreme_price_change",
          message: `Price range (${changePercent.toFixed(1)}%) exceeds 20% in a single candle`,
          severity: "warning",
          candle,
        });
      }
    }

    // Rule 8: zero volume on major pair warning
    if (candle.volume === 0) {
      warnings.push({
        rule: "zero_volume",
        message: "Volume is zero — may indicate exchange downtime",
        severity: "warning",
        candle,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateBatch(candles: Candle[]): { valid: Candle[]; invalid: Candle[]; results: Map<number, ValidationResult> } {
    const valid: Candle[] = [];
    const invalid: Candle[] = [];
    const results = new Map<number, ValidationResult>();

    for (const candle of candles) {
      const result = this.validate(candle);
      results.set(candle.time, result);
      if (result.valid) {
        valid.push(candle);
      } else {
        invalid.push(candle);
      }
    }

    return { valid, invalid, results };
  }
}
