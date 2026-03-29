import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme5Frame } from "./components/ThemeFrame";

const portfolio = mockData.portfolio;
const bots = mockData.bots;
const trades = mockData.trades;

const cards = [
  { label: "Total Value", value: `$${portfolio.totalValue.toLocaleString()}`, accent: true },
  { label: "24h P&L", value: `+$${(portfolio.totalValue * 0.023).toFixed(2)}`, positive: true },
  { label: "Active Bots", value: `${bots.filter((b) => b.status === "running").length}` },
  { label: "Win Rate", value: "67.3%" },
];

export default function Dashboard() {
  return (
    <Theme5Frame page="dashboard">
      {/* Portfolio cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="uv-card rounded-2xl p-5">
            <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              {c.label}
            </div>
            <div
              className={`text-2xl font-bold tabular-nums ${c.accent ? "uv-gradient-text" : ""}`}
              style={c.positive ? { color: "var(--profit)" } : undefined}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Allocation */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="col-span-2 uv-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Portfolio Performance</h2>
            <div className="flex gap-2">
              {["1D", "1W", "1M", "ALL"].map((t) => (
                <button
                  key={t}
                  className="px-3 py-1 rounded-lg text-xs"
                  style={{
                    background: t === "1W" ? "var(--accent-dim)" : "transparent",
                    color: t === "1W" ? "var(--accent)" : "var(--text-muted)",
                    border: t === "1W" ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <CandlestickChart data={mockData.candles} height={260} />
        </div>

        <div className="uv-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4">Allocation</h2>
          <div className="space-y-3">
            {portfolio.allocations.map((a) => (
              <div key={a.symbol}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{a.symbol}</span>
                  <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {a.weight.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--bg-tertiary)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${a.weight}%`,
                      background: "linear-gradient(90deg, var(--accent), var(--accent-hot))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Total Value
            </div>
            <div className="text-lg font-bold uv-gradient-text">
              ${portfolio.totalValue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Active Bots */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {bots
          .filter((b) => b.status === "running")
          .slice(0, 3)
          .map((bot) => (
            <div key={bot.id} className="uv-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">{bot.name}</span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--profit)", boxShadow: "0 0 8px var(--profit)" }}
                />
              </div>
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                {bot.pair} · {bot.strategy}
              </div>
              <div
                className="flex items-center justify-between mt-3 pt-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    P&L
                  </div>
                  <div
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: bot.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {bot.pnl >= 0 ? "+" : ""}${bot.pnl.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    P&L %
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{bot.pnlPct}%</div>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Recent Trades */}
      <div className="uv-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold mb-4">Recent Trades</h2>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="text-left py-2 font-medium">Pair</th>
              <th className="text-left py-2 font-medium">Side</th>
              <th className="text-right py-2 font-medium">Price</th>
              <th className="text-right py-2 font-medium">Qty</th>
              <th className="text-right py-2 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 8).map((t, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="py-2.5">{t.symbol}</td>
                <td
                  className="py-2.5 font-medium"
                  style={{ color: t.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                >
                  {t.side.toUpperCase()}
                </td>
                <td className="py-2.5 text-right tabular-nums">${t.price.toLocaleString()}</td>
                <td className="py-2.5 text-right tabular-nums">{t.amount}</td>
                <td className="py-2.5 text-right" style={{ color: "var(--text-muted)" }}>
                  {new Date(t.timestamp).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Theme5Frame>
  );
}
