import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme2Frame } from "./components/ThemeFrame";

export default function Dashboard() {
  const { portfolio, candles, bots, trades } = mockData;

  return (
    <Theme2Frame page="dashboard">
      {/* Portfolio Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "TOTAL_VALUE", value: `$${portfolio.totalValue.toLocaleString()}` },
          { label: "24H_DELTA", value: `+${portfolio.dailyChangePct}%`, color: "var(--profit)" },
          {
            label: "TOTAL_PNL",
            value: `+$${portfolio.totalPnl.toLocaleString()}`,
            color: "var(--profit)",
          },
          { label: "CASH_BAL", value: `$${portfolio.cashBalance.toLocaleString()}` },
        ].map((card) => (
          <div
            key={card.label}
            className="crt-border px-3 py-3"
            style={{ background: "var(--bg-card)" }}
          >
            <div className="text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>
              {card.label}
            </div>
            <div
              className="crt-glow text-lg tabular-nums"
              style={{ color: card.color ?? "var(--text-primary)" }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Allocation */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="col-span-2 crt-border p-3" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px]">
              <span style={{ color: "var(--text-muted)" }}>CHART: </span>
              <span className="crt-glow">BTC/USDT</span>
            </div>
            <div className="flex gap-1">
              {["1H", "4H", "1D", "1W"].map((tf) => (
                <button
                  key={tf}
                  className="px-2 py-0.5 text-[10px]"
                  style={{
                    color: tf === "1H" ? "#010a01" : "var(--text-muted)",
                    background: tf === "1H" ? "var(--accent)" : "transparent",
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <CandlestickChart data={candles} height={260} />
        </div>

        <div className="crt-border p-3" style={{ background: "var(--bg-card)" }}>
          <div className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
            ALLOCATION
          </div>
          <div className="space-y-2.5">
            {portfolio.allocations.map((a) => (
              <div key={a.symbol}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>{a.symbol}</span>
                  <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {a.weight}%
                  </span>
                </div>
                <div className="h-1 relative" style={{ background: "var(--bg-input)" }}>
                  <div
                    className="h-full absolute left-0 top-0"
                    style={{
                      width: `${a.weight}%`,
                      background: "var(--accent)",
                      boxShadow: "0 0 4px rgba(51,255,51,0.3)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>
              NET_ASSET_VALUE
            </div>
            <div className="crt-glow text-base tabular-nums mt-0.5">
              ${portfolio.totalValue.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Active Bots */}
      <div className="mb-4">
        <div className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
          ACTIVE_PROCESSES ({bots.filter((b) => b.status === "running").length})
        </div>
        <div className="grid grid-cols-3 gap-3">
          {bots
            .filter((b) => b.status === "running")
            .map((bot) => (
              <div
                key={bot.id}
                className="crt-border px-3 py-2.5"
                style={{ background: "var(--bg-card)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="animate-pulse text-[8px]" style={{ color: "var(--profit)" }}>
                    ●
                  </span>
                  <span className="text-xs">{bot.name}</span>
                  <span
                    className="ml-auto text-[9px] px-1 py-px"
                    style={{ background: "rgba(51,255,51,0.1)", color: "var(--text-muted)" }}
                  >
                    {bot.mode}
                  </span>
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {bot.strategy} · {bot.pair}
                </div>
                <div
                  className="crt-glow text-base tabular-nums mt-1.5"
                  style={{ color: bot.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                >
                  {bot.pnl >= 0 ? "+" : ""}
                  {bot.pnl.toLocaleString()} <span className="text-[10px]">({bot.pnlPct}%)</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Trades */}
      <div>
        <div className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
          TRADE_LOG
        </div>
        <div className="crt-border overflow-hidden" style={{ background: "var(--bg-card)" }}>
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ background: "var(--bg-secondary)" }}>
                {["TIME", "PAIR", "SIDE", "PRICE", "QTY", "FEE"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[9px] font-normal"
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
                  style={{
                    background: i % 2 === 0 ? "transparent" : "rgba(51,255,51,0.02)",
                    borderBottom: "1px solid rgba(51,255,51,0.05)",
                  }}
                >
                  <td className="px-3 py-1.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-1.5">{trade.symbol}</td>
                  <td
                    className="px-3 py-1.5 uppercase"
                    style={{ color: trade.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {trade.side}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">${trade.price.toLocaleString()}</td>
                  <td className="px-3 py-1.5 tabular-nums">{trade.amount}</td>
                  <td className="px-3 py-1.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                    ${trade.fee}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Theme2Frame>
  );
}
