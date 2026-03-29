import { PageCanvas } from "../shared/components/PageCanvas";

const stats = [
  { label: "24h Volume", value: "$2.1B" },
  { label: "Active Bots", value: "12.4K" },
  { label: "Avg Return", value: "+34.7%" },
  { label: "Uptime", value: "99.99%" },
];

const features = [
  {
    title: "Neural Grid Engine",
    desc: "AI-powered grid trading that adapts to volatility in real-time with sub-second execution.",
  },
  {
    title: "Sentiment Fusion",
    desc: "Cross-reference on-chain data, social signals, and order flow for alpha generation.",
  },
  {
    title: "Risk Shields",
    desc: "Multi-layer drawdown protection with automatic position scaling and circuit breakers.",
  },
  {
    title: "Zero-Latency Bridge",
    desc: "Direct exchange colocation connectors ensuring fastest possible order routing.",
  },
];

export default function Homepage() {
  return (
    <PageCanvas themeId="theme-5" pageId="homepage">
      <div
        className="min-h-screen relative overflow-hidden"
        style={{ background: "var(--bg-primary)" }}
      >
        {/* Background mesh */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(circle at 20% 30%, rgba(168,85,247,0.2) 0%, transparent 40%),
              radial-gradient(circle at 80% 70%, rgba(236,72,153,0.15) 0%, transparent 35%),
              radial-gradient(circle at 50% 50%, rgba(6,214,160,0.06) 0%, transparent 50%)
            `,
          }}
        />

        {/* Nav */}
        <nav
          className="relative z-10 flex items-center justify-between px-10 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)", color: "white" }}
            >
              UV
            </div>
            <span className="text-lg font-semibold uv-gradient-text">Ultraviolet</span>
          </div>
          <div
            className="flex items-center gap-6 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
              Docs
            </a>
            <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
              Pricing
            </a>
            <a
              href="/theme-5/dashboard"
              className="px-5 py-2 rounded-xl text-sm font-medium"
              style={{
                background: "linear-gradient(135deg, #a855f7, #ec4899)",
                color: "white",
                textDecoration: "none",
              }}
            >
              Launch App →
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative z-10 text-center pt-24 pb-16 px-10">
          <div
            className="inline-block px-4 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.1))",
              color: "var(--accent-hot)",
              border: "1px solid rgba(236,72,153,0.2)",
            }}
          >
            ✨ Now with Neural Grid Engine v3
          </div>
          <h1
            className="text-6xl font-bold mb-6 leading-tight uv-gradient-text"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Trading at the
            <br />
            Speed of Light
          </h1>
          <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: "var(--text-secondary)" }}>
            Ultraviolet is the next-generation algorithmic trading platform. Deploy AI-powered bots
            across any exchange in seconds.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="/theme-5/dashboard"
              className="px-8 py-3 rounded-xl text-sm font-semibold uv-glow"
              style={{
                background: "linear-gradient(135deg, #a855f7, #ec4899)",
                color: "white",
                textDecoration: "none",
              }}
            >
              Start Trading Free
            </a>
            <a
              href="/theme-5/bots"
              className="px-8 py-3 rounded-xl text-sm font-medium"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                textDecoration: "none",
              }}
            >
              Explore Bots
            </a>
          </div>
        </section>

        {/* Stats strip */}
        <section
          className="relative z-10 mx-10 my-8 grid grid-cols-4 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(168,85,247,0.05)",
            border: "1px solid var(--border)",
          }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="text-center py-6"
              style={{
                borderRight: i < stats.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <div className="text-3xl font-bold uv-gradient-text">{s.value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </section>

        {/* Features */}
        <section className="relative z-10 px-10 py-16">
          <h2
            className="text-2xl font-bold text-center mb-10"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Why Ultraviolet?
          </h2>
          <div className="grid grid-cols-2 gap-5 max-w-4xl mx-auto">
            {features.map((f, i) => (
              <div key={f.title} className="uv-card p-6 rounded-2xl">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4"
                  style={{
                    background: `linear-gradient(135deg, ${i % 2 === 0 ? "rgba(168,85,247,0.2)" : "rgba(6,214,160,0.2)"}, transparent)`,
                  }}
                >
                  {["🧠", "📡", "🛡️", "⚡"][i]}
                </div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative z-10 text-center py-16 px-10">
          <div
            className="max-w-2xl mx-auto py-12 px-10 rounded-3xl"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(236,72,153,0.08))",
              border: "1px solid var(--border)",
            }}
          >
            <h3
              className="text-2xl font-bold mb-3 uv-gradient-text"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Ready to Go Ultraviolet?
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Join thousands of traders using AI-powered algorithms to generate consistent returns.
            </p>
            <a
              href="/theme-5/dashboard"
              className="inline-block px-8 py-3 rounded-xl text-sm font-semibold uv-glow"
              style={{
                background: "linear-gradient(135deg, #a855f7, #ec4899)",
                color: "white",
                textDecoration: "none",
              }}
            >
              Launch Dashboard →
            </a>
          </div>
        </section>
      </div>
    </PageCanvas>
  );
}
