import { PageCanvas } from "../shared/components/PageCanvas";
import "./theme.css";

export default function Homepage() {
  return (
    <PageCanvas themeId="theme-1" pageId="homepage">
      <div
        className="min-h-screen"
        style={{ background: "#08080a", color: "#ede8dd", fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Nav */}
        <nav
          className="flex items-center justify-between px-12 py-5 border-b"
          style={{ borderColor: "rgba(200,165,90,0.10)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded flex items-center justify-center text-sm font-bold"
              style={{ background: "#c8a55a", color: "#08080a" }}
            >
              OV
            </div>
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "1.25rem",
                color: "#c8a55a",
                letterSpacing: "0.05em",
              }}
            >
              Obsidian Vault
            </span>
          </div>
          <div className="flex items-center gap-8">
            {["Features", "Performance", "Security"].map((l) => (
              <span
                key={l}
                className="text-sm cursor-pointer transition-opacity"
                style={{ color: "#9a9488" }}
              >
                {l}
              </span>
            ))}
            <a
              href="/theme-1/dashboard"
              className="px-6 py-2.5 text-sm font-medium rounded transition-all"
              style={{ background: "#c8a55a", color: "#08080a", textDecoration: "none" }}
            >
              Launch App
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative px-12 py-36 text-center overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(200,165,90,0.06) 0%, transparent 65%)",
            }}
          />
          <div className="relative max-w-3xl mx-auto">
            <p className="text-xs uppercase tracking-[0.3em] mb-6" style={{ color: "#c8a55a" }}>
              Algorithmic Trading Redefined
            </p>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "4rem",
                lineHeight: 1.08,
                fontWeight: 400,
              }}
            >
              Trade with the precision of{" "}
              <span style={{ color: "#c8a55a", fontStyle: "italic" }}>obsidian</span>
            </h1>
            <p
              className="mt-6 text-lg leading-relaxed max-w-lg mx-auto"
              style={{ color: "#9a9488" }}
            >
              An institutional-grade crypto trading platform engineered for sophisticated
              strategies, automated execution, and portfolio clarity.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <a
                href="/theme-1/dashboard"
                className="px-8 py-3.5 text-sm font-medium rounded"
                style={{ background: "#c8a55a", color: "#08080a", textDecoration: "none" }}
              >
                Start Trading
              </a>
              <a
                href="/theme-1/trading"
                className="px-8 py-3.5 text-sm font-medium rounded border"
                style={{
                  borderColor: "rgba(200,165,90,0.3)",
                  color: "#c8a55a",
                  textDecoration: "none",
                }}
              >
                View Terminal
              </a>
            </div>
          </div>
        </section>

        {/* Gold Rule */}
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(200,165,90,0.3), transparent)",
          }}
        />

        {/* Stats */}
        <section className="px-12 py-20">
          <div className="max-w-5xl mx-auto grid grid-cols-4 gap-12">
            {[
              { label: "Total Volume", value: "$2.4B+" },
              { label: "Active Bots", value: "12,400+" },
              { label: "Avg. Return", value: "18.7%" },
              { label: "Uptime", value: "99.97%" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "2.5rem",
                    color: "#c8a55a",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="mt-2 text-xs uppercase tracking-[0.2em]"
                  style={{ color: "#5f5b52" }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Gold Rule */}
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(200,165,90,0.3), transparent)",
          }}
        />

        {/* Features */}
        <section className="px-12 py-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#c8a55a" }}>
                Capabilities
              </p>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.5rem" }}>
                Built for the discerning trader
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {[
                {
                  title: "Multi-Exchange",
                  desc: "Connect Binance, Bybit, OKX, Kraken, and Coinbase with unified APIs and consistent UX.",
                },
                {
                  title: "Strategy Engine",
                  desc: "Deploy SMA, RSI, Bollinger, Grid, and custom strategies with paper-trade validation.",
                },
                {
                  title: "Real-Time Analytics",
                  desc: "Sharpe ratio, drawdown analysis, profit factor — all calculated in real time.",
                },
                {
                  title: "Risk Management",
                  desc: "Automated stop-loss, position sizing, and portfolio rebalancing guardrails.",
                },
                {
                  title: "Backtesting",
                  desc: "Test strategies against historical data with accurate fee and slippage modeling.",
                },
                {
                  title: "Secure by Design",
                  desc: "API keys encrypted at rest. No withdrawal permissions required.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="p-6 rounded border transition-colors"
                  style={{ borderColor: "rgba(200,165,90,0.10)", background: "#111114" }}
                >
                  <div className="w-8 h-px mb-5" style={{ background: "#c8a55a" }} />
                  <h3
                    className="mb-2.5"
                    style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.15rem" }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#9a9488" }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-12 py-24 text-center" style={{ background: "#111114" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem" }}>
            Begin your trading journey
          </h2>
          <p className="mt-4 text-sm" style={{ color: "#9a9488" }}>
            No credit card required. Paper trade to start.
          </p>
          <a
            href="/theme-1/dashboard"
            className="inline-block mt-8 px-10 py-4 text-sm font-medium rounded"
            style={{ background: "#c8a55a", color: "#08080a", textDecoration: "none" }}
          >
            Open Dashboard
          </a>
        </section>

        {/* Footer */}
        <footer
          className="px-12 py-6 border-t text-center"
          style={{ borderColor: "rgba(200,165,90,0.10)" }}
        >
          <p className="text-xs" style={{ color: "#5f5b52" }}>
            © 2026 Obsidian Vault · All rights reserved
          </p>
        </footer>
      </div>
    </PageCanvas>
  );
}
