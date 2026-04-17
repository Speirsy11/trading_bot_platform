import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="glass-panel flex flex-col items-center gap-6 p-12 text-center"
        style={{ maxWidth: "420px" }}
      >
        <p
          className="text-7xl font-bold tabular-nums"
          style={{ color: "var(--accent)", opacity: 0.7 }}
        >
          404
        </p>
        <div className="space-y-1">
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            Page not found
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
          style={{ background: "var(--accent)", color: "var(--primary-foreground)" }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
