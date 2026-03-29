import { PageCanvas } from "../shared/components/PageCanvas";
import "./theme.css";

export default function Homepage() {
  return (
    <PageCanvas themeId="theme-4" pageId="homepage">
      <div
        className="min-h-screen"
        style={{ background: "#111111", color: "#e8e0d4", fontFamily: "'Work Sans', sans-serif" }}
      >
        {/* Top bar */}
        <nav
          className="flex items-center justify-between px-8 py-4 border-b-2"
          style={{ borderColor: "#333" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center text-sm font-black"
              style={{ background: "#e87a20", color: "#111" }}
            >
              FG
            </div>
            <span
              style={{
                fontFamily: "'Tektur', sans-serif",
                fontSize: "1.3rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#e87a20",
              }}
            >
              FORGE
            </span>
          </div>
          <div className="flex items-center gap-6">
            {["SPECS", "STATUS", "DOCS"].map((l) => (
              <span
                key={l}
                className="text-xs cursor-pointer font-semibold tracking-wider"
                style={{ color: "#6b6156", fontFamily: "'Tektur', sans-serif" }}
              >
                {l}
              </span>
            ))}
            <a
              href="/theme-4/dashboard"
              className="px-5 py-2.5 text-xs font-black tracking-wider"
              style={{
                background: "#e87a20",
                color: "#111",
                textDecoration: "none",
                fontFamily: "'Tektur', sans-serif",
              }}
            >
              ENTER FORGE ▸
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative px-8 py-32">
          {/* Diagonal accent stripe */}
          <div
            className="absolute top-0 right-0 w-1/3 h-full pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, transparent 40%, rgba(232,122,32,0.06) 40%, rgba(232,122,32,0.06) 45%, transparent 45%)",
            }}
          />
          <div className="relative max-w-3xl">
            <div className="w-16 h-1 mb-8" style={{ background: "#e87a20" }} />
            <h1
              className="text-5xl mb-6 leading-tight"
              style={{
                fontFamily: "'Tektur', sans-serif",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              INDUSTRIAL-GRADE
              <br />
              <span style={{ color: "#e87a20" }}>TRADING ENGINE</span>
            </h1>
            <p className="text-base leading-relaxed max-w-lg mb-10" style={{ color: "#a89882" }}>
              Built for maximum throughput. Zero decoration. Pure performance. Multi-exchange
              automated trading with quant-grade analytics and ironclad risk controls.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="/theme-4/dashboard"
                className="px-8 py-3 text-sm font-black tracking-wider"
                style={{
                  background: "#e87a20",
                  color: "#111",
                  textDecoration: "none",
                  fontFamily: "'Tektur', sans-serif",
                }}
              >
                LAUNCH
              </a>
              <a
                href="/theme-4/trading"
                className="px-8 py-3 text-sm font-bold tracking-wider border-2"
                style={{
                  borderColor: "#333",
                  color: "#a89882",
                  textDecoration: "none",
                  fontFamily: "'Tektur', sans-serif",
                }}
              >
                TERMINAL
              </a>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section
          className="px-8 py-12 border-t-2 border-b-2"
          style={{ borderColor: "#333", background: "#1a1a1a" }}
        >
          <div className="max-w-5xl grid grid-cols-4 gap-0">
            {[
              { label: "VOLUME", value: "$2.4B+" },
              { label: "NODES", value: "12,400+" },
              { label: "AVG RETURN", value: "18.7%" },
              { label: "UPTIME", value: "99.97%" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="p-6"
                style={{ borderRight: i < 3 ? "2px solid #333" : "none" }}
              >
                <div
                  className="text-[10px] tracking-widest mb-2"
                  style={{ color: "#6b6156", fontFamily: "'Tektur', sans-serif" }}
                >
                  {stat.label}
                </div>
                <div
                  className="text-3xl font-bold tabular-nums"
                  style={{ color: "#e87a20", fontFamily: "'Tektur', sans-serif" }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="px-8 py-20">
          <div className="max-w-5xl">
            <div className="w-12 h-1 mb-6" style={{ background: "#e87a20" }} />
            <h2
              className="text-2xl mb-12"
              style={{
                fontFamily: "'Tektur', sans-serif",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              SPECIFICATIONS
            </h2>
            <div className="grid grid-cols-3 gap-0">
              {[
                {
                  title: "MULTI-EXCHANGE",
                  desc: "Binance, Bybit, OKX, Kraken, Coinbase — unified API layer.",
                },
                {
                  title: "STRATEGY ENGINE",
                  desc: "SMA Crossover, RSI, Bollinger, Grid, and custom modules.",
                },
                {
                  title: "ANALYTICS",
                  desc: "Sharpe, max drawdown, profit factor — computed in real time.",
                },
                {
                  title: "RISK MGMT",
                  desc: "Position sizing, stop-loss, and portfolio rebalancing.",
                },
                {
                  title: "BACKTESTING",
                  desc: "Historical replay engine with slippage and fee modeling.",
                },
                { title: "SECURITY", desc: "AES-256 key encryption. Zero withdrawal permissions." },
              ].map((f, i) => (
                <div
                  key={f.title}
                  className="p-6 border-2"
                  style={{ borderColor: "#333", marginRight: "-2px", marginBottom: "-2px" }}
                >
                  <div
                    className="text-[10px] tracking-widest mb-1"
                    style={{ color: "#e87a20", fontFamily: "'Tektur', sans-serif" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-sm mb-2" style={{ fontFamily: "'Tektur', sans-serif" }}>
                    {f.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "#a89882" }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          className="px-8 py-16 border-t-2"
          style={{ borderColor: "#333", background: "#1a1a1a" }}
        >
          <div className="text-center">
            <h2 style={{ fontFamily: "'Tektur', sans-serif", fontSize: "1.5rem", fontWeight: 700 }}>
              READY TO DEPLOY
            </h2>
            <p className="mt-3 text-sm" style={{ color: "#6b6156" }}>
              Paper trading. No credit card.
            </p>
            <a
              href="/theme-4/dashboard"
              className="inline-block mt-8 px-10 py-3.5 text-sm font-black tracking-wider"
              style={{
                background: "#e87a20",
                color: "#111",
                textDecoration: "none",
                fontFamily: "'Tektur', sans-serif",
              }}
            >
              INITIALIZE FORGE
            </a>
          </div>
        </section>

        <footer className="px-8 py-4 border-t-2 text-center" style={{ borderColor: "#333" }}>
          <p
            className="text-[10px] tracking-wider"
            style={{ color: "#6b6156", fontFamily: "'Tektur', sans-serif" }}
          >
            FORGE TRADING ENGINE © 2026
          </p>
        </footer>
      </div>
    </PageCanvas>
  );
}
