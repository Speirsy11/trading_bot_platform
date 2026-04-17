export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="h-8 w-36 animate-pulse rounded-lg" style={{ background: "var(--bg-card)" }} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Config form skeleton */}
        <div className="glass-panel p-5 space-y-4">
          <div
            className="h-6 w-32 animate-pulse rounded"
            style={{ background: "var(--bg-card)" }}
          />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div
                  className="h-3 w-16 animate-pulse rounded"
                  style={{ background: "var(--bg-card)" }}
                />
                <div
                  className="h-9 w-full animate-pulse rounded-lg"
                  style={{ background: "var(--bg-card)" }}
                />
              </div>
            ))}
          </div>
          <div
            className="h-10 w-full animate-pulse rounded-xl"
            style={{ background: "var(--bg-card)" }}
          />
        </div>

        {/* Past backtests skeleton */}
        <div className="glass-panel p-5 space-y-4">
          <div
            className="h-6 w-36 animate-pulse rounded"
            style={{ background: "var(--bg-card)" }}
          />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg"
                style={{ background: "var(--bg-card)" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
