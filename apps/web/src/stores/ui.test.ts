import { describe, it, expect, beforeEach } from "vitest";

import { useUiStore } from "@/stores/ui";

describe("useUiStore", () => {
  beforeEach(() => {
    const { setState } = useUiStore;
    setState({
      sidebarOpen: true,
      selectedSymbol: "BTC/USDT",
      selectedExchange: "binance",
    });
  });

  it("has correct defaults", () => {
    const state = useUiStore.getState();
    expect(state.sidebarOpen).toBe(true);
    expect(state.selectedSymbol).toBe("BTC/USDT");
    expect(state.selectedExchange).toBe("binance");
  });

  it("toggles sidebar", () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it("setSidebarOpen", () => {
    useUiStore.getState().setSidebarOpen(false);
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it("setSelectedSymbol", () => {
    useUiStore.getState().setSelectedSymbol("ETH/USDT");
    expect(useUiStore.getState().selectedSymbol).toBe("ETH/USDT");
  });

  it("setSelectedExchange", () => {
    useUiStore.getState().setSelectedExchange("bybit");
    expect(useUiStore.getState().selectedExchange).toBe("bybit");
  });
});
