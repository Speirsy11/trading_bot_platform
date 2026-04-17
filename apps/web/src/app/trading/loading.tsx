export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div
            className="h-7 w-28 animate-pulse rounded-lg"
            style={{ background: "var(--bg-card)" }}
          />
          <div
            className="h-5 w-40 animate-pulse rounded"
            style={{ background: "var(--bg-card)" }}
          />
        </div>
        <div className="flex gap-1">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-7 w-10 animate-pulse rounded-lg"
              style={{ background: "var(--bg-card)" }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Chart skeleton */}
        <div className="lg:col-span-3 glass-panel p-4">
          <div
            className="h-[500px] animate-pulse rounded-lg"
            style={{ background: "var(--bg-card)" }}
          />
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-4">
          {/* Order book skeleton */}
          <div className="glass-panel p-4 space-y-2">
            <div
              className="h-3 w-20 animate-pulse rounded"
              style={{ background: "var(--bg-card)" }}
            />
            {[...Array(11)].map((_, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded"
                style={{ background: "var(--bg-card)" }}
              />
            ))}
          </div>

          {/* Order form skeleton */}
          <div className="glass-panel p-4 space-y-3">
            <div
              className="h-3 w-20 animate-pulse rounded"
              style={{ background: "var(--bg-card)" }}
            />
            <div
              className="h-8 w-full animate-pulse rounded-lg"
              style={{ background: "var(--bg-card)" }}
            />
            <div
              className="h-8 w-full animate-pulse rounded-lg"
              style={{ background: "var(--bg-card)" }}
            />
            <div
              className="h-9 w-full animate-pulse rounded-lg"
              style={{ background: "var(--bg-card)" }}
            />
            <div
              className="h-10 w-full animate-pulse rounded-lg"
              style={{ background: "var(--bg-card)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
