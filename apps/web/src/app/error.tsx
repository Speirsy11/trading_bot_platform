"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="glass-panel flex flex-col items-center gap-4 p-10 text-center"
        style={{ maxWidth: "420px" }}
      >
        <p className="text-base font-medium" style={{ color: "var(--loss)" }}>
          Something went wrong
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {error.message}
        </p>
        <button
          onClick={reset}
          className="rounded-lg px-4 py-2 text-xs font-medium transition-colors"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
