"use client";

import type { Candle } from "@tb/types";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  ColorType,
} from "lightweight-charts";
import { useEffect, useRef, memo, useCallback } from "react";

import { getChartThemeTokens } from "@/lib/chartTheme";

interface CandlestickChartProps {
  data: Candle[];
  height?: number;
  markers?: Array<{
    time: number;
    position: "aboveBar" | "belowBar";
    color: string;
    shape: "arrowUp" | "arrowDown" | "circle";
    text: string;
  }>;
  onCrosshairMove?: (price: number | null, time: number | null) => void;
}

function CandlestickChartInner({
  data,
  height = 400,
  markers,
  onCrosshairMove,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const applySeriesData = useCallback(() => {
    if (!seriesRef.current) {
      return;
    }

    const formatted: CandlestickData[] = data.map((c) => ({
      time: (c.time / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(formatted);

    if (markers?.length) {
      createSeriesMarkers(
        seriesRef.current,
        markers.map((marker) => ({
          ...marker,
          time: (marker.time / 1000) as Time,
        }))
      );
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, markers]);

  const createChartInstance = useCallback(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
    }

    const colors = getChartThemeTokens();

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.textSecondary,
        fontFamily: colors.fontFamily,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        vertLine: {
          color: colors.textMuted,
          width: 1,
          style: 3,
          labelBackgroundColor: colors.bgCard,
        },
        horzLine: {
          color: colors.textMuted,
          width: 1,
          style: 3,
          labelBackgroundColor: colors.bgCard,
        },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: colors.profit,
      downColor: colors.loss,
      borderDownColor: colors.loss,
      borderUpColor: colors.profit,
      wickDownColor: colors.loss,
      wickUpColor: colors.profit,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    applySeriesData();

    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        if (!param.point || !param.time) {
          onCrosshairMove(null, null);
          return;
        }
        const candleData = param.seriesData.get(series) as CandlestickData | undefined;
        onCrosshairMove(
          candleData?.close ?? null,
          typeof param.time === "number" ? param.time : null
        );
      });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chartRef.current = null;
      seriesRef.current = null;
      chart.remove();
    };
  }, [height, onCrosshairMove, applySeriesData]);

  useEffect(() => {
    const cleanup = createChartInstance();
    return cleanup;
  }, [createChartInstance]);

  useEffect(() => {
    applySeriesData();
  }, [applySeriesData]);

  // Re-theme on colour scheme change
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (!chartRef.current || !seriesRef.current) return;
      const colors = getChartThemeTokens();
      chartRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: colors.textSecondary,
          fontFamily: colors.fontFamily,
        },
        grid: {
          vertLines: { color: colors.grid },
          horzLines: { color: colors.grid },
        },
        rightPriceScale: { borderColor: colors.border },
        timeScale: { borderColor: colors.border },
      });
      seriesRef.current.applyOptions({
        upColor: colors.profit,
        downColor: colors.loss,
        borderDownColor: colors.loss,
        borderUpColor: colors.profit,
        wickDownColor: colors.loss,
        wickUpColor: colors.profit,
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-color-scheme"],
    });

    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef} />;
}

export const CandlestickChart = memo(CandlestickChartInner);
