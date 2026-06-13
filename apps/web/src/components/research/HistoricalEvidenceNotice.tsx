import { ShieldCheck } from "lucide-react";

export function HistoricalEvidenceNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg p-3 text-sm ${className}`.trim()}
      style={{
        background: "rgba(200, 165, 90, 0.08)",
        color: "var(--text-secondary)",
        border: "1px solid rgba(200, 165, 90, 0.22)",
      }}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck size={18} style={{ color: "var(--accent)", flex: "0 0 auto" }} />
        <div>
          <div className="font-medium" style={{ color: "var(--text-primary)" }}>
            Historical evidence only
          </div>
          <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Badges mean this exact spot long/flat config passed fee- and slippage-adjusted
            out-of-sample gates. They are not live-trading signals or guarantees of future profit.
          </div>
        </div>
      </div>
    </div>
  );
}
