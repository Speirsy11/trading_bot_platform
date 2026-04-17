export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Header: title + stats row */}
      <div className="flex items-center justify-between">
        <div
          className="h-6 w-32 animate-pulse rounded-lg"
          style={{ background: "var(--bg-card)" }}
        />
        <div className="flex items-center gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-4 w-20 animate-pulse rounded"
              style={{ background: "var(--bg-card)" }}
            />
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-48 animate-pulse rounded-lg"
          style={{ background: "var(--bg-card)" }}
        />
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-9 w-16 animate-pulse rounded-lg"
              style={{ background: "var(--bg-card)" }}
            />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="glass-panel overflow-x-auto">
        {/* thead */}
        <div className="flex gap-4 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          {[80, 70, 80, 50, 80, 70, 70, 60].map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded"
              style={{ width: w, background: "var(--bg-card)" }}
            />
          ))}
        </div>
        {/* rows */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {[80, 70, 80, 50, 80, 70, 70, 60].map((w, j) => (
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
