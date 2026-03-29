import { PageCanvas } from "../shared/components/PageCanvas";
import "./theme.css";

export default function Homepage() {
  return (
    <PageCanvas themeId="theme-2" pageId="homepage">
      <div className="scanlines" />
      <div
        className="min-h-screen flex flex-col"
        style={{
          background: "#010a01",
          color: "#33ff33",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {/* Top bar */}
        <nav
          className="flex items-center justify-between px-8 py-4 border-b"
          style={{ borderColor: "rgba(51,255,51,0.12)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="crt-glow text-sm font-bold"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              ▌PHOSPHOR
            </span>
            <span className="text-[10px]" style={{ color: "#0d7a0d" }}>
              v2.0.0
            </span>
          </div>
          <div className="flex items-center gap-6">
            {["DOCS", "STATUS", "GITHUB"].map((l) => (
              <span key={l} className="text-[11px] cursor-pointer" style={{ color: "#1abf1a" }}>
                [{l}]
              </span>
            ))}
            <a
              href="/theme-2/dashboard"
              className="px-4 py-1.5 text-[11px] font-bold"
              style={{
                background: "#33ff33",
                color: "#010a01",
                textDecoration: "none",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              CONNECT &gt;
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center px-8 py-32 relative">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, rgba(51,255,51,0.04) 0%, transparent 60%)",
            }}
          />
          <div className="relative text-center max-w-2xl">
            <pre className="text-[10px] leading-snug mb-8" style={{ color: "#0d7a0d" }}>
              {`  ██████╗ ██╗  ██╗ ██████╗ ███████╗
  ██╔══██╗██║  ██║██╔═══██╗██╔════╝
  ██████╔╝███████║██║   ██║███████╗
  ██╔═══╝ ██╔══██║██║   ██║╚════██║
  ██║     ██║  ██║╚██████╔╝███████║
  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝`}
            </pre>
            <h1
              className="crt-glow text-2xl mb-4"
              style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em" }}
            >
              ALGORITHMIC TRADING ENGINE
            </h1>
            <div className="text-xs leading-relaxed mb-8" style={{ color: "#1abf1a" }}>
              <p>&gt; Multi-exchange automated crypto trading</p>
              <p>&gt; Strategy backtesting & paper trading</p>
              <p>&gt; Real-time portfolio analytics</p>
              <p>&gt; Sub-millisecond execution latency</p>
            </div>
            <div className="flex items-center gap-4 justify-center">
              <a
                href="/theme-2/dashboard"
                className="px-6 py-2 text-xs font-bold"
                style={{
                  background: "#33ff33",
                  color: "#010a01",
                  textDecoration: "none",
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                $ LAUNCH TERMINAL
              </a>
              <a
                href="/theme-2/trading"
                className="px-6 py-2 text-xs border"
                style={{
                  borderColor: "rgba(51,255,51,0.3)",
                  color: "#33ff33",
                  textDecoration: "none",
                }}
              >
                $ VIEW CHARTS
              </a>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="px-8 py-8 border-t" style={{ borderColor: "rgba(51,255,51,0.12)" }}>
          <div className="max-w-4xl mx-auto grid grid-cols-4 gap-8">
            {[
              { label: "THROUGHPUT", value: "2.4B+", unit: "USD" },
              { label: "ACTIVE NODES", value: "12,400", unit: "BOTS" },
              { label: "AVG RETURN", value: "18.7", unit: "PCT" },
              { label: "UPTIME", value: "99.97", unit: "PCT" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-[9px] tracking-wider mb-1" style={{ color: "#0d7a0d" }}>
                  {stat.label}
                </div>
                <div className="crt-glow text-xl tabular-nums">
                  {stat.value}
                  <span className="text-[10px] ml-1" style={{ color: "#0d7a0d" }}>
                    {stat.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features as terminal output */}
        <section
          className="px-8 py-16 border-t"
          style={{ borderColor: "rgba(51,255,51,0.12)", background: "#041204" }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="text-[10px] mb-6" style={{ color: "#0d7a0d" }}>
              $ cat /etc/phosphor/features.conf
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "exchange.multi", val: "Binance, Bybit, OKX, Kraken, Coinbase" },
                { key: "strategy.engine", val: "SMA, RSI, Bollinger, Grid, Custom" },
                { key: "analytics.real_time", val: "Sharpe, Drawdown, PnL factor" },
                { key: "risk.management", val: "Stop-loss, position sizing, rebalance" },
                { key: "backtest.engine", val: "Historical replay with fee modeling" },
                { key: "security.level", val: "AES-256 encrypted keys, no withdrawals" },
              ].map((f) => (
                <div
                  key={f.key}
                  className="px-4 py-3 crt-border"
                  style={{ background: "rgba(51,255,51,0.02)" }}
                >
                  <div className="text-[10px]" style={{ color: "#0d7a0d" }}>
                    {f.key} =
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#1abf1a" }}>
                    {f.val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          className="px-8 py-12 text-center border-t"
          style={{ borderColor: "rgba(51,255,51,0.12)" }}
        >
          <div className="text-xs mb-4" style={{ color: "#0d7a0d" }}>
            $ echo "Ready to initialize?"
          </div>
          <a
            href="/theme-2/dashboard"
            className="inline-block px-8 py-2.5 text-xs font-bold"
            style={{
              background: "#33ff33",
              color: "#010a01",
              textDecoration: "none",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            INIT --MODE=PAPER
          </a>
        </section>

        {/* Footer */}
        <footer
          className="px-8 py-4 border-t text-[9px] text-center"
          style={{ borderColor: "rgba(51,255,51,0.12)", color: "#0d7a0d" }}
        >
          PHOSPHOR TRADING ENGINE © 2026 · PID 4821 · ALL SYSTEMS NOMINAL
        </footer>
      </div>
    </PageCanvas>
  );
}
