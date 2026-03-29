import { describe, it, expect, beforeEach } from "vitest";

import { BotStateMachine, type BotState } from "../bot/BotStateMachine.js";

describe("BotStateMachine", () => {
  let sm: BotStateMachine;

  beforeEach(() => {
    sm = new BotStateMachine();
  });

  it("starts in INITIALIZED state", () => {
    expect(sm.getState()).toBe("INITIALIZED");
  });

  it("transitions INITIALIZED → RUNNING via start", () => {
    sm.transition("start");
    expect(sm.getState()).toBe("RUNNING");
  });

  it("transitions RUNNING → PAUSED via pause", () => {
    sm.transition("start");
    sm.transition("pause");
    expect(sm.getState()).toBe("PAUSED");
  });

  it("transitions PAUSED → RUNNING via resume", () => {
    sm.transition("start");
    sm.transition("pause");
    sm.transition("resume");
    expect(sm.getState()).toBe("RUNNING");
  });

  it("transitions RUNNING → STOPPING → STOPPED", () => {
    sm.transition("start");
    sm.transition("stop");
    expect(sm.getState()).toBe("STOPPING");
    sm.transition("stopped");
    expect(sm.getState()).toBe("STOPPED");
  });

  it("transitions RUNNING → ERROR", () => {
    sm.transition("start");
    sm.transition("error");
    expect(sm.getState()).toBe("ERROR");
  });

  it("transitions ERROR → INITIALIZED via restart", () => {
    sm.transition("start");
    sm.transition("error");
    sm.transition("restart");
    expect(sm.getState()).toBe("INITIALIZED");
  });

  it("transitions STOPPED → INITIALIZED via restart", () => {
    sm.transition("start");
    sm.transition("stop");
    sm.transition("stopped");
    sm.transition("restart");
    expect(sm.getState()).toBe("INITIALIZED");
  });

  it("throws on invalid transition", () => {
    expect(() => sm.transition("stop")).toThrow("Invalid transition");
  });

  it("canTransition reports correctly", () => {
    expect(sm.canTransition("start")).toBe(true);
    expect(sm.canTransition("stop")).toBe(false);
  });

  it("isRunning returns correct state", () => {
    expect(sm.isRunning()).toBe(false);
    sm.transition("start");
    expect(sm.isRunning()).toBe(true);
  });

  it("isStopped returns correct state", () => {
    sm.transition("start");
    sm.transition("stop");
    sm.transition("stopped");
    expect(sm.isStopped()).toBe(true);
  });

  it("fires transition listeners", () => {
    const transitions: [BotState, BotState][] = [];
    sm.onTransition((from, to) => transitions.push([from, to]));

    sm.transition("start");
    sm.transition("pause");

    expect(transitions).toEqual([
      ["INITIALIZED", "RUNNING"],
      ["RUNNING", "PAUSED"],
    ]);
  });
});
