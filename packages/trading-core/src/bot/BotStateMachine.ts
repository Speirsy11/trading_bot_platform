export type BotState = "INITIALIZED" | "RUNNING" | "PAUSED" | "STOPPING" | "STOPPED" | "ERROR";

interface Transition {
  from: BotState;
  to: BotState;
  action: string;
}

const VALID_TRANSITIONS: Transition[] = [
  { from: "INITIALIZED", to: "RUNNING", action: "start" },
  { from: "RUNNING", to: "PAUSED", action: "pause" },
  { from: "RUNNING", to: "STOPPING", action: "stop" },
  { from: "RUNNING", to: "ERROR", action: "error" },
  { from: "PAUSED", to: "RUNNING", action: "resume" },
  { from: "PAUSED", to: "STOPPING", action: "stop" },
  { from: "STOPPING", to: "STOPPED", action: "stopped" },
  { from: "ERROR", to: "INITIALIZED", action: "restart" },
  { from: "STOPPED", to: "INITIALIZED", action: "restart" },
];

/**
 * Manages bot state transitions.
 * Enforces valid state machine transitions.
 */
export class BotStateMachine {
  private state: BotState = "INITIALIZED";
  private listeners: ((from: BotState, to: BotState) => void)[] = [];

  getState(): BotState {
    return this.state;
  }

  transition(action: string): void {
    const valid = VALID_TRANSITIONS.find((t) => t.from === this.state && t.action === action);

    if (!valid) {
      throw new Error(`Invalid transition: cannot "${action}" from state "${this.state}"`);
    }

    const from = this.state;
    this.state = valid.to;

    for (const listener of this.listeners) {
      try {
        listener(from, valid.to);
      } catch {
        // Prevent one bad listener from stopping others
      }
    }
  }

  canTransition(action: string): boolean {
    return VALID_TRANSITIONS.some((t) => t.from === this.state && t.action === action);
  }

  onTransition(listener: (from: BotState, to: BotState) => void): void {
    this.listeners.push(listener);
  }

  isRunning(): boolean {
    return this.state === "RUNNING";
  }

  isStopped(): boolean {
    return this.state === "STOPPED" || this.state === "ERROR";
  }
}
