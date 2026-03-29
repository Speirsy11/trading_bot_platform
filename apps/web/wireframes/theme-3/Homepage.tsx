import { PageCanvas } from "../shared/components/PageCanvas";
import "./theme.css";

export default function Homepage() {
  return (
    <PageCanvas themeId="theme-3" pageId="homepage">
      <div
        className="min-h-screen relative"
        style={{ background: "#0a1628", color: "#f0f4f8", fontFamily: "'Outfit', sans-serif" }}
      >
        {/* Background orbs */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, rgba(94,174,255,0.12) 0%, transparent 40%), radial-gradient(circle at 70% 80%, rgba(74,222,128,0.06) 0%, transparent 35%)",
          }}
        />

        {/* Nav */}
        <nav
          className="relative z-10 flex items-center justify-between px-12 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, #5eaeff, #4ade80)", color: "#0a1628" }}
            >
              G
            </div>
            <span className="text-xl font-light tracking-wide">Glacier</span>
          </div>
          <div className="flex items-center gap-8">
            {["Platform", "Analytics", "Pricing"].map((l) => (
              <span key={l} className="text-sm cursor-pointer" style={{ color: "#94a8c4" }}>
                {l}
              </span>
            ))}
            <a
              href="/theme-3/dashboard"
              className="px-6 py-2.5 text-sm font-medium rounded-xl"
              style={{
                background: "linear-gradient(135deg, #5eaeff, #4ade80)",
                color: "#0a1628",
                textDecoration: "none",
              }}
            >
              Get Started
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative z-10 px-12 py-32 text-center">
          <div className="max-w-3xl mx-auto">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs mb-8"
              style={{
                background: "rgba(94,174,255,0.08)",
                border: "1px solid rgba(94,174,255,0.15)",
                color: "#5eaeff",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} />
              Now in public beta
            </div>
            <h1
              className="text-6xl leading-tight mb-6"
              style={{
                fontFamily: "'Crimson Pro', serif",
                fontWeight: 400,
                letterSpacing: "-0.02em",
              }}
            >
              Crystal clear{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #5eaeff, #4ade80)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                trading intelligence
              </span>
            </h1>
            <p
              className="text-lg leading-relaxed max-w-lg mx-auto mb-10"
              style={{ color: "#94a8c4" }}
            >
              A refined algorithmic trading platform with the precision of glacier-carved
              landscapes. Calm under pressure, powerful beneath the surface.
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="/theme-3/dashboard"
                className="px-8 py-3.5 text-sm font-medium rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #5eaeff, #4ade80)",
                  color: "#0a1628",
                  textDecoration: "none",
                }}
              >
                Open Dashboard
              </a>
              <a
                href="/theme-3/trading"
                className="glass-panel-sm px-8 py-3.5 text-sm"
                style={{ color: "#94a8c4", textDecoration: "none" }}
              >
                Explore Terminal
              </a>
            </div>
          </div>
        </section>

        {/* Stats in glass panels */}
        <section className="relative z-10 px-12 pb-20">
          <div className="max-w-5xl mx-auto grid grid-cols-4 gap-5">
            {[
              { label: "Total Volume", value: "$2.4B+" },
              { label: "Active Bots", value: "12,400+" },
              { label: "Avg. Return", value: "18.7%" },
              { label: "Uptime", value: "99.97%" },
            ].map((stat) => (
              <div key={stat.label} className="glass-panel p-6 text-center">
                <div
                  className="text-3xl mb-1"
                  style={{
                    fontFamily: "'Crimson Pro', serif",
                    background: "linear-gradient(135deg, #5eaeff, #4ade80)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {stat.value}
                </div>
                <div className="text-xs" style={{ color: "#546a8c" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section
          className="relative z-10 px-12 py-24"
          style={{ background: "rgba(15, 29, 51, 0.5)" }}
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2
                className="text-4xl mb-3"
                style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 400 }}
              >
                Everything you need
              </h2>
              <p className="text-sm" style={{ color: "#546a8c" }}>
                Built for modern trading workflows
              </p>
            </div>
            <div className="grid grid-cols-3 gap-5">
              {[
                {
                  title: "Multi-Exchange",
                  desc: "Unified API across Binance, Bybit, OKX, Kraken, and Coinbase.",
                },
                {
                  title: "Strategy Engine",
                  desc: "Deploy and backtest SMA, RSI, Bollinger, and custom strategies.",
                },
                {
                  title: "Live Analytics",
                  desc: "Sharpe ratio, drawdown, profit factor — all streaming in real-time.",
                },
                {
                  title: "Risk Controls",
                  desc: "Automated stop-loss, position limits, and portfolio guardrails.",
                },
                {
                  title: "Backtesting",
                  desc: "Historical replay with accurate fee and slippage simulations.",
                },
                {
                  title: "Encryption",
                  desc: "API keys encrypted at rest. Zero withdrawal permissions required.",
                },
              ].map((feature) => (
                <div key={feature.title} className="glass-panel p-6">
                  <div
                    className="w-8 h-0.5 mb-5 rounded-full"
                    style={{ background: "linear-gradient(90deg, #5eaeff, #4ade80)" }}
                  />
                  <h3 className="text-lg mb-2" style={{ fontFamily: "'Crimson Pro', serif" }}>
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#94a8c4" }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative z-10 px-12 py-24 text-center">
          <h2
            className="text-3xl mb-4"
            style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 400 }}
          >
            Start with paper trading
          </h2>
          <p className="text-sm mb-8" style={{ color: "#546a8c" }}>
            No credit card. No risk. Full access.
          </p>
          <a
            href="/theme-3/dashboard"
            className="inline-block px-10 py-4 text-sm font-medium rounded-xl"
            style={{
              background: "linear-gradient(135deg, #5eaeff, #4ade80)",
              color: "#0a1628",
              textDecoration: "none",
            }}
          >
            Launch Glacier
          </a>
        </section>

        <footer
          className="relative z-10 px-12 py-6 border-t text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs" style={{ color: "#546a8c" }}>
            © 2026 Glacier Trading · Built with clarity
          </p>
        </footer>
      </div>
    </PageCanvas>
  );
}
