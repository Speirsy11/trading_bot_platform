"use client";

import { LineChart } from "echarts/charts";
import { TooltipComponent, GridComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { memo, useMemo } from "react";

import { getChartThemeTokens, withAlpha } from "@/lib/chartTheme";

echarts.use([LineChart, TooltipComponent, GridComponent, CanvasRenderer]);

interface PerformanceChartProps {
  data: Array<{ time: number; value: number }>;
  comparisonData?: Array<{ time: number; value: number }>;
  extraSeries?: Array<{
    name: string;
    data: Array<{ time: number; value: number }>;
    color?: string;
  }>;
  height?: number;
  color?: string;
  comparisonColor?: string;
  seriesName?: string;
  comparisonName?: string;
}

function PerformanceChartInner({
  data,
  comparisonData,
  extraSeries,
  height = 250,
  color,
  comparisonColor,
  seriesName = "Strategy",
  comparisonName = "Benchmark",
}: PerformanceChartProps) {
  const option = useMemo(() => {
    const {
      textSecondary,
      grid,
      accent: defaultAccent,
      bgCard,
      fontFamily,
    } = getChartThemeTokens();
    const accent = color ?? defaultAccent;
    const benchmarkColor = comparisonColor ?? textSecondary;

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
          name: seriesName,
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
        ...(comparisonData?.length
          ? [
              {
                name: comparisonName,
                type: "line" as const,
                data: comparisonData.map((d) => [d.time, d.value]),
                smooth: true,
                showSymbol: false,
                lineStyle: { color: benchmarkColor, width: 1.5, type: "dashed" as const },
              },
            ]
          : []),
        ...(extraSeries ?? []).map((series) => ({
          name: series.name,
          type: "line" as const,
          data: series.data.map((d) => [d.time, d.value]),
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: series.color ?? benchmarkColor,
            width: 1.35,
          },
        })),
      ],
    };
  }, [comparisonData, comparisonName, data, color, comparisonColor, extraSeries, seriesName]);

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
