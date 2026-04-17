export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="h-8 w-48 animate-pulse rounded-lg" style={{ background: "var(--bg-card)" }} />
      {/* Card row skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="glass-panel h-28 animate-pulse rounded-xl"
            style={{ background: "var(--bg-card)" }}
          />
        ))}
      </div>
      {/* Main panel skeleton */}
      <div
        className="glass-panel h-64 animate-pulse rounded-xl"
        style={{ background: "var(--bg-card)" }}
      />
    </div>
  );
}
