"use client";

import { PieChart } from "echarts/charts";
import { TooltipComponent, LegendComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { memo, useMemo } from "react";

import { getChartThemeTokens } from "@/lib/chartTheme";

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer]);

interface PortfolioPieChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
}

function PortfolioPieChartInner({ data, height = 250 }: PortfolioPieChartProps) {
  const option = useMemo(() => {
    const { textSecondary, bgCard, fontFamily } = getChartThemeTokens();

    const COLORS = ["#c8a55a", "#6ee7a0", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

    return {
      tooltip: {
        trigger: "item" as const,
        backgroundColor: bgCard,
        borderColor: "transparent",
        textStyle: { color: textSecondary, fontSize: 12 },
        formatter: "{b}: ${c} ({d}%)",
      },
      series: [
        {
          type: "pie" as const,
          radius: ["50%", "75%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: "transparent", borderWidth: 2 },
          label: {
            show: true,
            position: "outside" as const,
            color: textSecondary,
            fontSize: 11,
            fontFamily,
          },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: "bold" as const },
          },
          data: data.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: d.color ?? COLORS[i % COLORS.length] },
          })),
        },
      ],
    };
  }, [data]);

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge
      style={{ height }}
      opts={{ renderer: "canvas" }}
    />
  );
}

export const PortfolioPieChart = memo(PortfolioPieChartInner);
