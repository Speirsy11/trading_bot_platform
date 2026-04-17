import { create } from "zustand";
import { persist } from "zustand/middleware";

function syncSidebarDom(sidebarOpen: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  // On mobile (< 768px / md breakpoint) the sidebar is an overlay — no margin shift.
  if (window.innerWidth < 768) {
    return;
  }

  const mainContent = document.getElementById("main-content");
  if (mainContent) {
    mainContent.style.marginLeft = sidebarOpen ? "240px" : "64px";
  }
}

interface UiState {
  sidebarOpen: boolean;
  selectedSymbol: string;
  selectedExchange: string;
  defaultExchange: string;
  defaultSymbol: string;
  dashboardWidgets: string[];
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedExchange: (exchange: string) => void;
  setDefaultExchange: (exchange: string) => void;
  setDefaultSymbol: (symbol: string) => void;
  setDashboardWidgets: (widgets: string[]) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      selectedSymbol: "BTC/USDT",
      selectedExchange: "binance",
      defaultExchange: "binance",
      defaultSymbol: "BTC/USDT",
      dashboardWidgets: ["portfolio", "bots", "allocation"],
      toggleSidebar: () =>
        set((state) => {
          const sidebarOpen = !state.sidebarOpen;
          syncSidebarDom(sidebarOpen);
          return { sidebarOpen };
        }),
      setSidebarOpen: (open) => {
        syncSidebarDom(open);
        set({ sidebarOpen: open });
      },
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      setSelectedExchange: (exchange) => set({ selectedExchange: exchange }),
      setDefaultExchange: (exchange) => set({ defaultExchange: exchange }),
      setDefaultSymbol: (symbol) => set({ defaultSymbol: symbol }),
      setDashboardWidgets: (widgets) => set({ dashboardWidgets: widgets }),
    }),
    {
      name: "tb-ui-store",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        selectedSymbol: state.selectedSymbol,
        selectedExchange: state.selectedExchange,
        defaultExchange: state.defaultExchange,
        defaultSymbol: state.defaultSymbol,
        dashboardWidgets: state.dashboardWidgets,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          syncSidebarDom(state.sidebarOpen);
        }
      },
    }
  )
);
