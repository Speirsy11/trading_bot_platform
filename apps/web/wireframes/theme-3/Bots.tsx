import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme3Frame } from "./components/ThemeFrame";

const statusMap: Record<string, { bg: string; dot: string; text: string }> = {
  running: { bg: "rgba(74,222,128,0.10)", dot: "var(--profit)", text: "var(--profit)" },
  stopped: { bg: "rgba(248,113,113,0.10)", dot: "var(--loss)", text: "var(--loss)" },
  paused: { bg: "rgba(94,174,255,0.10)", dot: "var(--accent)", text: "var(--accent)" },
  error: { bg: "rgba(248,113,113,0.15)", dot: "#ef4444", text: "#ef4444" },
};

export default function Bots() {
  const { bots, botMetrics, candles } = mockData;
  const selected = bots[0]!;
  const metrics = botMetrics[selected.id]!;

  return (
    <Theme3Frame page="bots">
      {/* Filter */}
      <div className="flex items-center gap-3 mb-6 glass-panel px-5 py-3">
        {["All Status", "All Exchanges", "All Strategies"].map((filter) => (
          <select
            key={filter}
            className="px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
            defaultValue=""
          >
            <option value="">{filter}</option>
          </select>
        ))}
        <div className="ml-auto">
          <button
            className="px-5 py-2 text-xs font-medium rounded-lg"
            style={{
              background: "linear-gradient(135deg, #5eaeff, #4ade80)",
              color: "#0a1628",
            }}
          >
            + New Bot
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Table */}
        <div className="col-span-2 glass-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Bot", "Strategy", "Pair", "Exchange", "Status", "PnL", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-normal"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => {
                const st = statusMap[bot.status] ?? statusMap.stopped!;
                return (
                  <tr
                    key={bot.id}
                    className="cursor-pointer transition-colors"
                    style={{
                      background: bot.id === selected.id ? "rgba(94,174,255,0.06)" : "transparent",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                    }}
                  >
                    <td className="px-4 py-3 text-xs font-medium">{bot.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {bot.strategy}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">{bot.pair}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {bot.exchange}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full capitalize"
                        style={{ background: st.bg, color: st.text }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                        {bot.status}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-xs tabular-nums font-medium"
                      style={{ color: bot.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                    >
                      {bot.pnl >= 0 ? "+" : ""}${bot.pnl.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {bot.status === "running" ? (
                          <button
                            className="px-2.5 py-1 text-[10px] rounded-md"
                            style={{ background: "rgba(248,113,113,0.1)", color: "var(--loss)" }}
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            className="px-2.5 py-1 text-[10px] rounded-md"
                            style={{ background: "rgba(74,222,128,0.1)", color: "var(--profit)" }}
                          >
                            Start
                          </button>
                        )}
                        <button
                          className="px-2.5 py-1 text-[10px] rounded-md"
                          style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bot Detail */}
        <div className="space-y-5">
          <div className="glass-panel p-5">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: statusMap[selected.status]?.dot,
                  boxShadow: `0 0 8px ${statusMap[selected.status]?.dot}`,
                }}
              />
              <h3 className="text-lg" style={{ fontFamily: "'Crimson Pro', serif" }}>
                {selected.name}
              </h3>
            </div>
            <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              {selected.strategy} · {selected.pair} · {selected.exchange}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Sharpe Ratio", value: metrics.sharpe.toFixed(2) },
                { label: "Win Rate", value: `${metrics.winRate}%` },
                { label: "Max Drawdown", value: `${metrics.maxDrawdown}%`, color: "var(--loss)" },
                { label: "Profit Factor", value: metrics.profitFactor.toFixed(2) },
                { label: "Total Return", value: `${metrics.totalReturn}%`, color: "var(--profit)" },
                { label: "Mode", value: selected.mode },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-3 rounded-lg"
                  style={{ background: "var(--bg-input)" }}
                >
                  <div className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                    {m.label}
                  </div>
                  <div
                    className="text-sm tabular-nums font-medium capitalize"
                    style={{ color: m.color ?? "var(--text-primary)" }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel p-4">
            <h3 className="text-sm mb-3 font-medium" style={{ color: "var(--text-secondary)" }}>
              Equity Curve
            </h3>
            <CandlestickChart data={candles.slice(-60)} height={160} />
          </div>
        </div>
      </div>
    </Theme3Frame>
  );
}
