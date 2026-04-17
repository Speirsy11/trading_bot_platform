const DEFAULT_DELAY_MS = 100;
const MAX_DELAY_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;
const RECOVERY_FACTOR = 0.95;

export class AdaptiveRateLimiter {
  private delays: Map<string, number>;

  constructor() {
    this.delays = new Map();
  }

  private getDelay(exchange: string): number {
    return this.delays.get(exchange) ?? DEFAULT_DELAY_MS;
  }

  onRateLimit(exchange: string): void {
    const current = this.getDelay(exchange);
    const next = Math.min(current * BACKOFF_MULTIPLIER, MAX_DELAY_MS);
    this.delays.set(exchange, next);
  }

  onSuccess(exchange: string): void {
    const current = this.getDelay(exchange);
    if (current <= DEFAULT_DELAY_MS) return;
    const next = Math.max(current * RECOVERY_FACTOR, DEFAULT_DELAY_MS);
    this.delays.set(exchange, next);
  }

  wait(exchange: string): Promise<void> {
    const delay = this.getDelay(exchange);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
