"use client";

import { LineChart } from "echarts/charts";
import { TooltipComponent, GridComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { memo, useMemo } from "react";

import { getChartThemeTokens, withAlpha } from "@/lib/chartTheme";
import { useUiStore } from "@/stores/ui";

echarts.use([LineChart, TooltipComponent, GridComponent, CanvasRenderer]);

interface PerformanceChartProps {
  data: Array<{ time: number; value: number }>;
  height?: number;
  color?: string;
}

function PerformanceChartInner({ data, height = 250, color }: PerformanceChartProps) {
  const colourScheme = useUiStore((s) => s.colourScheme);

  const option = useMemo(() => {
    const {
      textSecondary,
      grid,
      accent: defaultAccent,
      bgCard,
      fontFamily,
    } = getChartThemeTokens(colourScheme);
    const accent = color ?? defaultAccent;

    return {
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: bgCard,
        borderColor: "transparent",
        textStyle: { color: textSecondary, fontSize: 12, fontFamily },
      },
      grid: { left: 60, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: "time" as const,
        axisLine: { lineStyle: { color: grid } },
        axisLabel: { color: textSecondary, fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value" as const,
        axisLine: { show: false },
        axisLabel: { color: textSecondary, fontSize: 10 },
        splitLine: { lineStyle: { color: grid } },
      },
      series: [
        {
          type: "line" as const,
          data: data.map((d) => [d.time, d.value]),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: accent, width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlpha(accent, 0.18) },
              { offset: 1, color: withAlpha(accent, 0.02) },
            ]),
          },
        },
      ],
    };
  }, [data, color, colourScheme]);

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

export const PerformanceChart = memo(PerformanceChartInner);
