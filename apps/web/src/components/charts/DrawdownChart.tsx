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

interface DrawdownChartProps {
  data: Array<{ time: number; drawdown: number }>;
  height?: number;
}

function DrawdownChartInner({ data, height = 200 }: DrawdownChartProps) {
  const colourScheme = useUiStore((s) => s.colourScheme);

  const option = useMemo(() => {
    const { textSecondary, grid, loss, bgCard, fontFamily } = getChartThemeTokens(colourScheme);

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
        axisLabel: { color: textSecondary, fontSize: 10, formatter: "{value}%" },
        splitLine: { lineStyle: { color: grid } },
        max: 0,
      },
      series: [
        {
          type: "line" as const,
          data: data.map((d) => [d.time, d.drawdown]),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: loss, width: 1.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlpha(loss, 0.02) },
              { offset: 1, color: withAlpha(loss, 0.18) },
            ]),
          },
        },
      ],
    };
  }, [data, colourScheme]);

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

export const DrawdownChart = memo(DrawdownChartInner);
