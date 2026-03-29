import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme4Frame } from "./components/ThemeFrame";

export default function Dashboard() {
  const { portfolio, candles, bots, trades } = mockData;

  return (
    <Theme4Frame page="dashboard">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "TOTAL VALUE", value: `$${portfolio.totalValue.toLocaleString()}` },
          { label: "24H CHANGE", value: `+${portfolio.dailyChangePct}%`, color: "var(--profit)" },
          {
            label: "TOTAL PNL",
            value: `+$${portfolio.totalPnl.toLocaleString()}`,
            color: "var(--profit)",
          },
          { label: "CASH", value: `$${portfolio.cashBalance.toLocaleString()}` },
        ].map((card) => (
          <div key={card.label} className="forge-panel p-4">
            <div
              className="text-[9px] tracking-widest mb-1.5"
              style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
            >
              {card.label}
            </div>
            <div
              className="text-2xl font-bold tabular-nums"
              style={{ color: card.color ?? "var(--text-primary)" }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Alloc */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="col-span-2 forge-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm">BTC / USDT</h2>
            <div className="flex gap-1">
              {["1H", "4H", "1D", "1W"].map((tf) => (
                <button
                  key={tf}
                  className="px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    color: tf === "1H" ? "#111" : "var(--text-muted)",
                    background: tf === "1H" ? "var(--accent)" : "transparent",
                    fontFamily: "'Tektur', sans-serif",
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <CandlestickChart data={candles} height={280} />
        </div>

        <div className="forge-panel p-4">
          <h2 className="text-sm mb-4">ALLOCATION</h2>
          <div className="space-y-3">
            {portfolio.allocations.map((a) => (
              <div key={a.symbol}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold">{a.symbol}</span>
                  <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {a.weight}%
                  </span>
                </div>
                <div className="h-2" style={{ background: "var(--bg-input)" }}>
                  <div
                    className="h-full"
                    style={{ width: `${a.weight}%`, background: "var(--accent)" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t-2" style={{ borderColor: "var(--border-hard)" }}>
            <div
              className="text-[9px] tracking-widest"
              style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
            >
              NET VALUE
            </div>
            <div className="text-lg font-bold tabular-nums mt-0.5">
              ${portfolio.totalValue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Active Bots */}
      <div className="mb-5">
        <h2 className="text-sm mb-3">ACTIVE BOTS</h2>
        <div className="grid grid-cols-3 gap-3">
          {bots
            .filter((b) => b.status === "running")
            .map((bot) => (
              <div key={bot.id} className="forge-panel-flat p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2" style={{ background: "var(--profit)" }} />
                  <span className="text-xs font-bold">{bot.name}</span>
                  <span
                    className="ml-auto text-[9px] px-1.5 py-px font-bold tracking-wider"
                    style={{
                      background: "var(--accent-dim)",
                      color: "var(--accent)",
                      fontFamily: "'Tektur', sans-serif",
                    }}
                  >
                    {bot.mode.toUpperCase()}
                  </span>
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {bot.strategy} · {bot.pair}
                </div>
                <div
                  className="text-xl font-bold tabular-nums mt-2"
                  style={{ color: bot.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                >
                  {bot.pnl >= 0 ? "+" : ""}${bot.pnl.toLocaleString()}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Trades */}
      <div>
        <h2 className="text-sm mb-3">TRADE LOG</h2>
        <div className="forge-panel-flat overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr
                className="border-b-2"
                style={{ borderColor: "var(--border-hard)", background: "var(--bg-secondary)" }}
              >
                {["TIME", "PAIR", "SIDE", "PRICE", "QTY", "FEE"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[9px] font-bold tracking-widest"
                    style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
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
                  style={{
                    background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)",
                    borderBottom: "1px solid var(--border-hard)",
                  }}
                >
                  <td className="px-3 py-2 tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2 font-semibold">{trade.symbol}</td>
                  <td
                    className="px-3 py-2 uppercase font-bold"
                    style={{ color: trade.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {trade.side}
                  </td>
                  <td className="px-3 py-2 tabular-nums">${trade.price.toLocaleString()}</td>
                  <td className="px-3 py-2 tabular-nums">{trade.amount}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: "var(--text-muted)" }}>
                    ${trade.fee}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Theme4Frame>
  );
}
