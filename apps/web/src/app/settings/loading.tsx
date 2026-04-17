export default function Loading() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page title */}
      <div className="h-6 w-24 animate-pulse rounded-lg" style={{ background: "var(--bg-card)" }} />

      {/* Exchange connections panel */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div
            className="h-4 w-44 animate-pulse rounded"
            style={{ background: "var(--bg-card)" }}
          />
          <div
            className="h-8 w-36 animate-pulse rounded-lg"
            style={{ background: "var(--bg-card)" }}
          />
        </div>
        <div className="h-4 w-72 animate-pulse rounded" style={{ background: "var(--bg-card)" }} />
      </div>

      {/* Defaults panel */}
      <div className="glass-panel p-6 space-y-4">
        <div className="h-4 w-20 animate-pulse rounded" style={{ background: "var(--bg-card)" }} />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div
                className="h-3 w-28 animate-pulse rounded"
                style={{ background: "var(--bg-card)" }}
              />
              <div
                className="h-9 w-full animate-pulse rounded-lg"
                style={{ background: "var(--bg-card)" }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
