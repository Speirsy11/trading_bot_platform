import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme1Frame } from "./components/ThemeFrame";

export default function Dashboard() {
  const { portfolio, candles, bots, trades } = mockData;

  return (
    <Theme1Frame page="dashboard">
      {/* Portfolio Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: "Total Value", value: `$${portfolio.totalValue.toLocaleString()}` },
          { label: "24h Change", value: `+${portfolio.dailyChangePct}%`, color: "var(--profit)" },
          {
            label: "Total PnL",
            value: `+$${portfolio.totalPnl.toLocaleString()}`,
            color: "var(--profit)",
          },
          { label: "Cash Balance", value: `$${portfolio.cashBalance.toLocaleString()}` },
        ].map((card) => (
          <div
            key={card.label}
            className="p-5 rounded border"
            style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
          >
            <div
              className="text-xs uppercase tracking-wider mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              {card.label}
            </div>
            <div
              className="text-2xl font-medium tabular-nums"
              style={{ color: card.color ?? "var(--text-primary)" }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Allocation */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div
          className="col-span-2 rounded border p-5"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base">BTC / USDT</h2>
            <div className="flex gap-1.5">
              {["1H", "4H", "1D", "1W"].map((tf) => (
                <button
                  key={tf}
                  className="px-2.5 py-1 text-xs rounded transition-colors"
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

        <div
          className="rounded border p-5"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <h2 className="text-base mb-5">Allocation</h2>
          <div className="space-y-4">
            {portfolio.allocations.map((a) => (
              <div key={a.symbol}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span style={{ color: "var(--text-secondary)" }}>{a.symbol}</span>
                  <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {a.weight}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--bg-input)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${a.weight}%`, background: "var(--accent)" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <div
              className="text-xs uppercase tracking-wider mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Total
            </div>
            <div className="text-xl tabular-nums">${portfolio.totalValue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Active Bots */}
      <div className="mb-8">
        <h2 className="text-base mb-4">Active Bots</h2>
        <div className="grid grid-cols-3 gap-4">
          {bots
            .filter((b) => b.status === "running")
            .map((bot) => (
              <div
                key={bot.id}
                className="p-4 rounded border"
                style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--profit)" }} />
                  <span className="text-sm font-medium">{bot.name}</span>
                  <span
                    className="ml-auto text-[10px] uppercase px-1.5 py-0.5 rounded"
                    style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                  >
                    {bot.mode}
                  </span>
                </div>
                <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>
                  {bot.strategy}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {bot.pair} · {bot.exchange}
                </div>
                <div
                  className="mt-3 text-xl tabular-nums"
                  style={{ color: bot.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                >
                  {bot.pnl >= 0 ? "+" : ""}${bot.pnl.toLocaleString()}
                  <span className="text-xs ml-1 opacity-70">({bot.pnlPct}%)</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Recent Trades */}
      <div>
        <h2 className="text-base mb-4">Recent Trades</h2>
        <div className="rounded border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-card)" }}>
                {["Time", "Symbol", "Side", "Price", "Amount", "Fee"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs uppercase tracking-wider font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 10).map((trade, i) => (
                <tr
                  key={trade.id}
                  className="transition-colors"
                  style={{ background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--bg-card)" }}
                >
                  <td
                    className="px-4 py-2.5 text-xs tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{trade.symbol}</td>
                  <td
                    className="px-4 py-2.5 text-xs uppercase font-medium"
                    style={{ color: trade.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {trade.side}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">${trade.price.toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums">{trade.amount}</td>
                  <td
                    className="px-4 py-2.5 tabular-nums text-xs"
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
    </Theme1Frame>
  );
}
