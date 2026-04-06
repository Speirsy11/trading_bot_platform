import { EventEmitter } from "events";

import { createLogger } from "@tb/config";

const logger = createLogger("reconnect-handler");

export interface ReconnectOptions {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  maxAttempts: number; // 0 = unlimited
}

const DEFAULT_OPTIONS: ReconnectOptions = {
  initialDelayMs: 1000,
  maxDelayMs: 60_000,
  multiplier: 2,
  maxAttempts: 0,
};

export class ReconnectHandler extends EventEmitter {
  private options: ReconnectOptions;
  private attempt: number = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: Partial<ReconnectOptions>) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  get currentAttempt(): number {
    return this.attempt;
  }

  scheduleReconnect(connectFn: () => Promise<void>) {
    this.attempt++;

    if (this.options.maxAttempts > 0 && this.attempt > this.options.maxAttempts) {
      this.emit("max-attempts-reached", this.attempt);
      return;
    }

    const delay = Math.min(
      this.options.initialDelayMs * Math.pow(this.options.multiplier, this.attempt - 1),
      this.options.maxDelayMs
    );

    logger.info({ attempt: this.attempt, delayMs: delay }, "Scheduling reconnect");

    this.timer = setTimeout(async () => {
      try {
        await connectFn();
        this.reset();
        this.emit("reconnected");
      } catch (err) {
        this.emit("reconnect-failed", err);
        this.scheduleReconnect(connectFn);
      }
    }, delay);
  }

  reset() {
    this.attempt = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy() {
    this.reset();
    this.removeAllListeners();
  }
}
