import { describe, it, expect, beforeEach } from "vitest";

import { useUiStore } from "@/stores/ui";

describe("useUiStore", () => {
  beforeEach(() => {
    const { setState } = useUiStore;
    setState({
      colourScheme: "glacier",
      sidebarOpen: true,
      selectedSymbol: "BTC/USDT",
      selectedExchange: "binance",
    });
  });

  it("has correct defaults", () => {
    const state = useUiStore.getState();
    expect(state.colourScheme).toBe("glacier");
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

  it("setColourScheme updates state and DOM", () => {
    useUiStore.getState().setColourScheme("obsidian");
    expect(useUiStore.getState().colourScheme).toBe("obsidian");
    expect(document.documentElement.dataset.colorScheme).toBe("obsidian");
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
