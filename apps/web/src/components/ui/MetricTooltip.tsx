interface MetricTooltipProps {
  term: string;
  definition: string;
}

export function MetricTooltip({ term, definition }: MetricTooltipProps) {
  return (
    <span className="relative inline-flex items-center" style={{ verticalAlign: "middle" }}>
      <span
        className="metric-tooltip-trigger inline-flex items-center justify-center rounded-full text-xs font-medium cursor-default select-none ml-1"
        style={{
          width: "14px",
          height: "14px",
          background: "var(--bg-input)",
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
          fontSize: "9px",
          lineHeight: 1,
        }}
        aria-label={`Explain ${term}`}
      >
        ?
      </span>
      <span
        className="metric-tooltip-popup pointer-events-none absolute z-50 rounded-lg px-3 py-2 text-xs"
        style={{
          background: "var(--bg-panel, #1a1d23)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          maxWidth: "220px",
          width: "max-content",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          opacity: 0,
          transition: "opacity 0.15s ease",
          whiteSpace: "normal",
          lineHeight: "1.4",
        }}
      >
        <span className="block font-medium mb-0.5 text-xs" style={{ color: "var(--accent)" }}>
          {term}
        </span>
        {definition}
      </span>
      <style>{`
        .metric-tooltip-trigger:hover + .metric-tooltip-popup,
        .metric-tooltip-trigger:focus + .metric-tooltip-popup {
          opacity: 1 !important;
        }
      `}</style>
    </span>
  );
}
