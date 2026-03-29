import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme3Frame } from "./components/ThemeFrame";

export default function Dashboard() {
  const { portfolio, candles, bots, trades } = mockData;

  return (
    <Theme3Frame page="dashboard">
      {/* Portfolio Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: "Total Value", value: `$${portfolio.totalValue.toLocaleString()}`, icon: "◈" },
          {
            label: "24h Change",
            value: `+${portfolio.dailyChangePct}%`,
            color: "var(--profit)",
            icon: "△",
          },
          {
            label: "Total PnL",
            value: `+$${portfolio.totalPnl.toLocaleString()}`,
            color: "var(--profit)",
            icon: "◇",
          },
          {
            label: "Cash Available",
            value: `$${portfolio.cashBalance.toLocaleString()}`,
            icon: "○",
          },
        ].map((card) => (
          <div key={card.label} className="glass-panel p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs" style={{ color: "var(--accent)" }}>
                {card.icon}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {card.label}
              </span>
            </div>
            <div
              className="text-2xl font-light tabular-nums"
              style={{ color: card.color ?? "var(--text-primary)" }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Allocation */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="col-span-2 glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg" style={{ fontFamily: "'Crimson Pro', serif" }}>
              BTC / USDT
            </h2>
            <div className="flex gap-1.5">
              {["1H", "4H", "1D", "1W"].map((tf) => (
                <button
                  key={tf}
                  className="px-3 py-1 text-xs rounded-lg transition-all"
                  style={{
                    color: tf === "1H" ? "var(--accent)" : "var(--text-muted)",
                    background: tf === "1H" ? "var(--accent-dim)" : "transparent",
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <CandlestickChart data={candles} height={300} />
        </div>

        <div className="glass-panel p-5">
          <h2 className="text-lg mb-5" style={{ fontFamily: "'Crimson Pro', serif" }}>
            Portfolio
          </h2>
          <div className="space-y-4">
            {portfolio.allocations.map((a) => (
              <div key={a.symbol}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span style={{ color: "var(--text-secondary)" }}>{a.symbol}</span>
                  <span className="tabular-nums">{a.weight}%</span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--bg-input)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${a.weight}%`,
                      background: "linear-gradient(90deg, #5eaeff, #4ade80)",
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              Net Asset Value
            </div>
            <div className="text-xl tabular-nums font-light">
              ${portfolio.totalValue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Active Bots */}
      <div className="mb-8">
        <h2 className="text-lg mb-4" style={{ fontFamily: "'Crimson Pro', serif" }}>
          Active Bots
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {bots
            .filter((b) => b.status === "running")
            .map((bot) => (
              <div key={bot.id} className="glass-panel-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: "var(--profit)",
                      boxShadow: "0 0 6px rgba(74,222,128,0.4)",
                    }}
                  />
                  <span className="text-sm font-medium">{bot.name}</span>
                  <span
                    className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                  >
                    {bot.mode}
                  </span>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {bot.strategy} · {bot.pair}
                </div>
                <div
                  className="text-xl font-light tabular-nums mt-3"
                  style={{ color: bot.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                >
                  {bot.pnl >= 0 ? "+" : ""}${bot.pnl.toLocaleString()}
                  <span className="text-xs ml-1 opacity-60">({bot.pnlPct}%)</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Trades */}
      <div>
        <h2 className="text-lg mb-4" style={{ fontFamily: "'Crimson Pro', serif" }}>
          Recent Trades
        </h2>
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Time", "Symbol", "Side", "Price", "Amount", "Fee"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-normal"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 10).map((trade) => (
                <tr
                  key={trade.id}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  <td
                    className="px-5 py-2.5 text-xs tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-5 py-2.5 text-xs">{trade.symbol}</td>
                  <td
                    className="px-5 py-2.5 text-xs capitalize font-medium"
                    style={{ color: trade.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {trade.side}
                  </td>
                  <td className="px-5 py-2.5 tabular-nums">${trade.price.toLocaleString()}</td>
                  <td className="px-5 py-2.5 tabular-nums">{trade.amount}</td>
                  <td
                    className="px-5 py-2.5 tabular-nums text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ${trade.fee}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Theme3Frame>
  );
}
