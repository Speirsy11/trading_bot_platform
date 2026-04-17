export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header: title + button */}
      <div className="flex items-center justify-between">
        <div
          className="h-8 w-20 animate-pulse rounded-lg"
          style={{ background: "var(--bg-card)" }}
        />
        <div
          className="h-9 w-28 animate-pulse rounded-xl"
          style={{ background: "var(--bg-card)" }}
        />
      </div>

      {/* Search bar + filter pills */}
      <div className="flex items-center gap-3">
        <div
          className="h-9 flex-1 max-w-sm animate-pulse rounded-xl"
          style={{ background: "var(--bg-card)" }}
        />
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-7 w-14 animate-pulse rounded-lg"
              style={{ background: "var(--bg-card)" }}
            />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="glass-panel overflow-hidden">
        {/* thead */}
        <div className="flex gap-4 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          {[80, 100, 90, 90, 70, 60].map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded"
              style={{ width: w, background: "var(--bg-card)" }}
            />
          ))}
        </div>
        {/* rows */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4 py-3"
            style={{ borderBottom: "1px solid var(--grid)" }}
          >
            {[80, 100, 90, 90, 70, 60].map((w, j) => (
              <div
                key={j}
                className="h-4 animate-pulse rounded"
                style={{ width: w, background: "var(--bg-card)" }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
