"use client";

import { IndicatorCalculator } from "@tb/indicators";
import type { Candle } from "@tb/types";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
  ColorType,
} from "lightweight-charts";
import { useEffect, useRef, memo, useCallback, useState } from "react";

import { getChartThemeTokens } from "@/lib/chartTheme";

export interface IndicatorConfig {
  sma?: { period?: number; color?: string };
  ema?: { period?: number; color?: string };
  bbands?: {
    period?: number;
    stdDev?: number;
    upperColor?: string;
    lowerColor?: string;
    midColor?: string;
  };
  rsi?: { period?: number };
}

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
  showIndicatorControls?: boolean;
  indicators?: IndicatorConfig;
}

interface OHLCTooltip {
  open: number;
  high: number;
  low: number;
  close: number;
}

type IndicatorKey = "SMA" | "EMA" | "BBands" | "RSI";

const calc = new IndicatorCalculator();

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Align a shorter indicator array to the tail of the candles array */
function alignToEnd(
  candles: Candle[],
  values: number[]
): Array<{ time: Time; value: number } | null> {
  const offset = candles.length - values.length;
  return candles.map((c, i) => {
    const vi = i - offset;
    if (vi < 0) return null;
    return { time: (c.time / 1000) as Time, value: values[vi] as number };
  });
}

function CandlestickChartInner({
  data,
  height = 400,
  markers,
  onCrosshairMove,
  showIndicatorControls = false,
  indicators,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Indicator series refs
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMidRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(new Set());
  const [crosshairData, setCrosshairData] = useState<OHLCTooltip | null>(null);
  const [currentRsi, setCurrentRsi] = useState<number | null>(null);

  const toggleIndicator = useCallback((ind: IndicatorKey) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) {
        next.delete(ind);
      } else {
        next.add(ind);
      }
      return next;
    });
  }, []);

  const applySeriesData = useCallback(() => {
    if (!seriesRef.current) return;

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

  // Apply indicator data whenever active set or data changes
  const applyIndicatorData = useCallback(() => {
    if (!chartRef.current || data.length === 0) return;

    const closes = data.map((c) => c.close);

    // ── SMA ──────────────────────────────────────────────────────────────────
    if (activeIndicators.has("SMA") && smaSeriesRef.current) {
      const period = indicators?.sma?.period ?? 20;
      const values = calc.sma(closes, period);
      const aligned = alignToEnd(data, values);
      const lineData: LineData[] = aligned
        .filter((p): p is { time: Time; value: number } => p !== null)
        .map((p) => ({ time: p.time, value: p.value }));
      smaSeriesRef.current.setData(lineData);
    } else if (smaSeriesRef.current) {
      smaSeriesRef.current.setData([]);
    }

    // ── EMA ──────────────────────────────────────────────────────────────────
    if (activeIndicators.has("EMA") && emaSeriesRef.current) {
      const period = indicators?.ema?.period ?? 20;
      const values = calc.ema(closes, period);
      const aligned = alignToEnd(data, values);
      const lineData: LineData[] = aligned
        .filter((p): p is { time: Time; value: number } => p !== null)
        .map((p) => ({ time: p.time, value: p.value }));
      emaSeriesRef.current.setData(lineData);
    } else if (emaSeriesRef.current) {
      emaSeriesRef.current.setData([]);
    }

    // ── Bollinger Bands ───────────────────────────────────────────────────────
    if (
      activeIndicators.has("BBands") &&
      bbUpperRef.current &&
      bbMidRef.current &&
      bbLowerRef.current
    ) {
      const period = indicators?.bbands?.period ?? 20;
      const stdDev = indicators?.bbands?.stdDev ?? 2;
      const bb = calc.bollingerBands(closes, period, stdDev);

      const toLineData = (values: number[]): LineData[] =>
        alignToEnd(data, values)
          .filter((p): p is { time: Time; value: number } => p !== null)
          .map((p) => ({ time: p.time, value: p.value }));

      bbUpperRef.current.setData(toLineData(bb.upper));
      bbMidRef.current.setData(toLineData(bb.middle));
      bbLowerRef.current.setData(toLineData(bb.lower));
    } else {
      bbUpperRef.current?.setData([]);
      bbMidRef.current?.setData([]);
      bbLowerRef.current?.setData([]);
    }

    // ── RSI badge ─────────────────────────────────────────────────────────────
    if (activeIndicators.has("RSI") && closes.length > 0) {
      const period = indicators?.rsi?.period ?? 14;
      const values = calc.rsi(closes, period);
      setCurrentRsi(values.length > 0 ? (values[values.length - 1] ?? null) : null);
    } else {
      setCurrentRsi(null);
    }
  }, [data, activeIndicators, indicators]);

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

    // Add indicator line series
    const smaSeries = chart.addSeries(LineSeries, {
      color: indicators?.sma?.color ?? "#c8a55a",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const emaSeries = chart.addSeries(LineSeries, {
      color: indicators?.ema?.color ?? "#5ab8c8",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbUpper = chart.addSeries(LineSeries, {
      color: indicators?.bbands?.upperColor ?? "rgba(150,100,220,0.5)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbMid = chart.addSeries(LineSeries, {
      color: indicators?.bbands?.midColor ?? "rgba(150,100,220,0.9)",
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbLower = chart.addSeries(LineSeries, {
      color: indicators?.bbands?.lowerColor ?? "rgba(150,100,220,0.5)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    smaSeriesRef.current = smaSeries;
    emaSeriesRef.current = emaSeries;
    bbUpperRef.current = bbUpper;
    bbMidRef.current = bbMid;
    bbLowerRef.current = bbLower;

    applySeriesData();

    // Crosshair subscription — always active for OHLC tooltip + optional callback
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        setCrosshairData(null);
        onCrosshairMove?.(null, null);
        return;
      }
      const candleData = param.seriesData.get(series) as CandlestickData | undefined;
      if (candleData) {
        setCrosshairData({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
        });
      }
      onCrosshairMove?.(
        candleData?.close ?? null,
        typeof param.time === "number" ? param.time : null
      );
    });

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
      smaSeriesRef.current = null;
      emaSeriesRef.current = null;
      bbUpperRef.current = null;
      bbMidRef.current = null;
      bbLowerRef.current = null;
      chart.remove();
    };
  }, [height, onCrosshairMove, applySeriesData, indicators]);

  useEffect(() => {
    const cleanup = createChartInstance();
    return cleanup;
  }, [createChartInstance]);

  useEffect(() => {
    applySeriesData();
  }, [applySeriesData]);

  useEffect(() => {
    applyIndicatorData();
  }, [applyIndicatorData]);

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

  const ALL_INDICATORS: IndicatorKey[] = ["SMA", "EMA", "BBands", "RSI"];

  const rsiColor =
    currentRsi === null
      ? "var(--text-muted)"
      : currentRsi > 70
        ? "var(--loss)"
        : currentRsi < 30
          ? "var(--profit)"
          : "var(--text-secondary)";

  return (
    <div>
      {showIndicatorControls && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {ALL_INDICATORS.map((ind) => (
            <button
              key={ind}
              onClick={() => toggleIndicator(ind)}
              className="text-xs px-2 py-1 rounded"
              style={{
                background: activeIndicators.has(ind) ? "var(--accent-dim)" : "var(--bg-input)",
                color: activeIndicators.has(ind) ? "var(--accent)" : "var(--text-muted)",
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              {ind}
            </button>
          ))}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <div ref={containerRef} />

        {/* OHLC crosshair tooltip */}
        {crosshairData && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              fontFamily: "monospace",
              fontSize: 11,
              pointerEvents: "none",
              color: "var(--text-secondary)",
              background: "var(--bg-card)",
              borderRadius: 4,
              padding: "2px 6px",
              opacity: 0.9,
              zIndex: 10,
            }}
          >
            O:&nbsp;{fmt(crosshairData.open)}&nbsp;&nbsp;H:&nbsp;{fmt(crosshairData.high)}
            &nbsp;&nbsp;L:&nbsp;{fmt(crosshairData.low)}&nbsp;&nbsp;C:&nbsp;
            {fmt(crosshairData.close)}
          </div>
        )}

        {/* RSI badge */}
        {activeIndicators.has("RSI") && currentRsi !== null && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              fontFamily: "monospace",
              fontSize: 11,
              pointerEvents: "none",
              color: rsiColor,
              background: "var(--bg-card)",
              borderRadius: 4,
              padding: "2px 6px",
              opacity: 0.9,
              zIndex: 10,
              border: "1px solid var(--border)",
            }}
          >
            RSI({indicators?.rsi?.period ?? 14}):&nbsp;{currentRsi.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}

export const CandlestickChart = memo(CandlestickChartInner);
