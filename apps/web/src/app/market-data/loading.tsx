export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div
          className="h-6 w-32 animate-pulse rounded-lg"
          style={{ background: "var(--bg-card)" }}
        />
        <div
          className="h-9 w-28 animate-pulse rounded-lg"
          style={{ background: "var(--bg-card)" }}
        />
      </div>

      {/* Filters panel */}
      <div className="glass-panel p-4">
        <div className="flex flex-wrap gap-4">
          {[96, 200, 260].map((w, i) => (
            <div key={i} className="space-y-1">
              <div
                className="h-3 w-16 animate-pulse rounded"
                style={{ background: "var(--bg-card)" }}
              />
              <div
                className="h-9 animate-pulse rounded-lg"
                style={{ width: w, background: "var(--bg-card)" }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Symbol list skeleton */}
        <div className="glass-panel p-4 space-y-1">
          <div
            className="h-3 w-24 animate-pulse rounded mb-3"
            style={{ background: "var(--bg-card)" }}
          />
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-lg"
              style={{ background: "var(--bg-card)" }}
            />
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="lg:col-span-2 glass-panel p-4">
          <div
            className="h-[450px] animate-pulse rounded-lg"
            style={{ background: "var(--bg-card)" }}
          />
        </div>
      </div>
    </div>
  );
}
