import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColourScheme = "obsidian" | "phosphor" | "glacier" | "forge" | "ultraviolet";

function syncUiDom(state: Pick<UiState, "colourScheme" | "sidebarOpen">) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.colorScheme = state.colourScheme;
  const mainContent = document.getElementById("main-content");
  if (mainContent) {
    mainContent.style.marginLeft = state.sidebarOpen ? "220px" : "64px";
  }
}

interface UiState {
  colourScheme: ColourScheme;
  sidebarOpen: boolean;
  selectedSymbol: string;
  selectedExchange: string;
  defaultExchange: string;
  defaultSymbol: string;
  setColourScheme: (scheme: ColourScheme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedExchange: (exchange: string) => void;
  setDefaultExchange: (exchange: string) => void;
  setDefaultSymbol: (symbol: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      colourScheme: "glacier",
      sidebarOpen: true,
      selectedSymbol: "BTC/USDT",
      selectedExchange: "binance",
      defaultExchange: "binance",
      defaultSymbol: "BTC/USDT",
      setColourScheme: (scheme) => {
        syncUiDom({ colourScheme: scheme, sidebarOpen: useUiStore.getState().sidebarOpen });
        set({ colourScheme: scheme });
      },
      toggleSidebar: () =>
        set((state) => {
          const sidebarOpen = !state.sidebarOpen;
          syncUiDom({ colourScheme: state.colourScheme, sidebarOpen });
          return { sidebarOpen };
        }),
      setSidebarOpen: (open) =>
        set((state) => {
          syncUiDom({ colourScheme: state.colourScheme, sidebarOpen: open });
          return { sidebarOpen: open };
        }),
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      setSelectedExchange: (exchange) => set({ selectedExchange: exchange }),
      setDefaultExchange: (exchange) => set({ defaultExchange: exchange }),
      setDefaultSymbol: (symbol) => set({ defaultSymbol: symbol }),
    }),
    {
      name: "tb-ui-store",
      partialize: (state) => ({
        colourScheme: state.colourScheme,
        sidebarOpen: state.sidebarOpen,
        selectedSymbol: state.selectedSymbol,
        selectedExchange: state.selectedExchange,
        defaultExchange: state.defaultExchange,
        defaultSymbol: state.defaultSymbol,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          syncUiDom({ colourScheme: state.colourScheme, sidebarOpen: state.sidebarOpen });
        }
      },
    }
  )
);
