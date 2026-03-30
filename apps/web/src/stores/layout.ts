import type { LayoutItem } from "react-grid-layout";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LayoutState {
  dashboardLayout: LayoutItem[];
  setDashboardLayout: (layout: LayoutItem[]) => void;
}

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "portfolio-summary", x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
  { i: "chart", x: 0, y: 2, w: 8, h: 6, minW: 4, minH: 4 },
  { i: "allocation", x: 8, y: 2, w: 4, h: 6, minW: 3, minH: 4 },
  { i: "active-bots", x: 0, y: 8, w: 6, h: 4, minW: 3, minH: 3 },
  { i: "recent-trades", x: 6, y: 8, w: 6, h: 4, minW: 3, minH: 3 },
];

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      dashboardLayout: DEFAULT_LAYOUT,
      setDashboardLayout: (layout) => set({ dashboardLayout: layout }),
    }),
    { name: "tb-layout-store" }
  )
);
