const DEFAULT_THRESHOLD_PCT = 20;

/**
 * Reads the balance-drop threshold percentage from:
 *   1. riskConfig.balanceDropThresholdPct  (per-bot, takes priority)
 *   2. env BALANCE_DROP_THRESHOLD_PCT
 *   3. hard-coded default of 20 %
 *
 * A "catastrophic drop" is defined as the account balance falling by at least
 * this percentage below the balance recorded at bot startup.
 */
export function getBalanceDropThreshold(riskConfig?: Record<string, unknown>): number {
  const perBot = riskConfig?.["balanceDropThresholdPct"];
  if (typeof perBot === "number" && Number.isFinite(perBot) && perBot > 0 && perBot < 100) {
    return perBot;
  }

  const envVal = process.env["BALANCE_DROP_THRESHOLD_PCT"];
  if (envVal) {
    const parsed = Number(envVal);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 100) {
      return parsed;
    }
  }

  return DEFAULT_THRESHOLD_PCT;
}

/**
 * Tracks balance snapshots for a single bot run and detects catastrophic drops.
 *
 * A drop is "catastrophic" when the current balance has fallen by at least
 * `thresholdPct` percent relative to `startingBalance`.
 */
export class BalanceDropDetector {
  constructor(
    private readonly startingBalance: number,
    private readonly thresholdPct: number
  ) {
    if (startingBalance < 0) throw new Error("Starting balance must be non-negative");
    if (thresholdPct <= 0 || thresholdPct >= 100)
      throw new Error("Threshold must be between 0 and 100 (exclusive)");
  }

  /**
   * Returns the percentage drop from the starting balance (0–100).
   * A positive value means the balance has decreased.
   */
  dropPercent(currentBalance: number): number {
    if (this.startingBalance <= 0) return 0;
    return ((this.startingBalance - currentBalance) / this.startingBalance) * 100;
  }

  /**
   * Returns true if the current balance represents a catastrophic drop
   * (i.e. drop >= thresholdPct).
   */
  check(currentBalance: number): boolean {
    return this.dropPercent(currentBalance) >= this.thresholdPct;
  }
}
