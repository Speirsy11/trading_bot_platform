"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="glass-panel p-8 flex flex-col items-center gap-4 text-center">
      <p style={{ color: "var(--loss)" }}>Something went wrong</p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {error.message}
      </p>
      <button
        onClick={reset}
        className="text-xs px-3 py-1.5 rounded-lg"
        style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
      >
        Try again
      </button>
    </div>
  );
}
