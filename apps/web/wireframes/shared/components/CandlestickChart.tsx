import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { Candle } from "../types";

interface CandlestickChartProps {
  data: Candle[];
  height?: number;
}

export function CandlestickChart({ data, height = 320 }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const styles = getComputedStyle(container);
    const chart = createChart(container, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: styles.getPropertyValue("--muted").trim() || "#94a3b8",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: styles.getPropertyValue("--grid").trim() || "rgba(148,163,184,0.12)" },
        horzLines: { color: styles.getPropertyValue("--grid").trim() || "rgba(148,163,184,0.12)" },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
      },
      crosshair: {
        vertLine: { color: styles.getPropertyValue("--accent").trim() || "#38bdf8" },
        horzLine: { color: styles.getPropertyValue("--accent").trim() || "#38bdf8" },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: styles.getPropertyValue("--profit").trim() || "#34d399",
      downColor: styles.getPropertyValue("--loss").trim() || "#fb7185",
      borderVisible: false,
      wickUpColor: styles.getPropertyValue("--profit").trim() || "#34d399",
      wickDownColor: styles.getPropertyValue("--loss").trim() || "#fb7185",
    });

    series.setData(
      data.map((candle) => ({
        ...candle,
        time: candle.time as Time,
      }))
    );

    const observer = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });

    observer.observe(container);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
