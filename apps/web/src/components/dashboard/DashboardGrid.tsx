"use client";

import { useCallback } from "react";
import { type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";

import { useLayoutStore } from "@/stores/layout";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Responsive, WidthProvider } = require("react-grid-layout");

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  children: React.ReactNode;
}

export function DashboardGrid({ children }: DashboardGridProps) {
  const layout = useLayoutStore((s) => s.dashboardLayout);
  const setLayout = useLayoutStore((s) => s.setDashboardLayout);

  const onLayoutChange = useCallback(
    (newLayout: LayoutItem[], allLayouts: Record<string, LayoutItem[]>) => {
      setLayout(allLayouts.lg ?? newLayout);
    },
    [setLayout]
  );

  return (
    <ResponsiveGridLayout
      className="dashboard-grid"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
      rowHeight={60}
      onLayoutChange={onLayoutChange}
      isDraggable
      isResizable
      compactType="vertical"
      margin={[16, 16]}
    >
      {children}
    </ResponsiveGridLayout>
  );
}
