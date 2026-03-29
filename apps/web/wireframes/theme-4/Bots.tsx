import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme4Frame } from "./components/ThemeFrame";

const statusMap: Record<string, { bg: string; color: string }> = {
  running: { bg: "rgba(34,197,94,0.12)", color: "var(--profit)" },
  stopped: { bg: "rgba(239,68,68,0.12)", color: "var(--loss)" },
  paused: { bg: "rgba(232,122,32,0.12)", color: "var(--accent)" },
  error: { bg: "rgba(239,68,68,0.18)", color: "#ef4444" },
};

export default function Bots() {
  const { bots, botMetrics, candles } = mockData;
  const selected = bots[0]!;
  const metrics = botMetrics[selected.id]!;

  return (
    <Theme4Frame page="bots">
      {/* Filter */}
      <div className="flex items-center gap-3 mb-4 forge-panel-flat px-4 py-2.5">
        <span
          className="text-[9px] tracking-widest font-bold"
          style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
        >
          FILTER:
        </span>
        {["STATUS", "EXCHANGE", "STRATEGY"].map((f) => (
          <select
            key={f}
            className="px-2 py-1 text-[10px] outline-none"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              border: "2px solid var(--border-hard)",
            }}
            defaultValue=""
          >
            <option value="">ALL {f}</option>
          </select>
        ))}
        <div className="ml-auto">
          <button
            className="px-4 py-1.5 text-[10px] font-black tracking-wider"
            style={{
              background: "var(--accent)",
              color: "#111",
              fontFamily: "'Tektur', sans-serif",
            }}
          >
            + NEW BOT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Table */}
        <div className="col-span-2 forge-panel-flat overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr
                className="border-b-2"
                style={{ borderColor: "var(--border-hard)", background: "var(--bg-secondary)" }}
              >
                {["#", "BOT", "STRATEGY", "PAIR", "XCHG", "STATUS", "PNL", "ACTION"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-2.5 text-left text-[9px] font-bold tracking-widest"
                    style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bots.map((bot, i) => {
                const st = statusMap[bot.status] ?? statusMap.stopped!;
                const isSelected = bot.id === selected.id;
                return (
                  <tr
                    key={bot.id}
                    className="cursor-pointer"
                    style={{
                      background: isSelected
                        ? "var(--accent-dim)"
                        : i % 2 === 0
                          ? "var(--bg-card)"
                          : "var(--bg-secondary)",
                      borderBottom: "1px solid var(--border-hard)",
                    }}
                  >
                    <td
                      className="px-2 py-2 tabular-nums font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-2 py-2 font-bold">{bot.name}</td>
                    <td className="px-2 py-2" style={{ color: "var(--text-secondary)" }}>
                      {bot.strategy}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{bot.pair}</td>
                    <td className="px-2 py-2" style={{ color: "var(--text-secondary)" }}>
                      {bot.exchange}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className="text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-wider"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {bot.status}
                      </span>
                    </td>
                    <td
                      className="px-2 py-2 tabular-nums font-bold"
                      style={{ color: bot.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                    >
                      {bot.pnl >= 0 ? "+" : ""}${bot.pnl.toLocaleString()}
                    </td>
                    <td className="px-2 py-2">
                      {bot.status === "running" ? (
                        <button
                          className="px-2 py-0.5 text-[9px] font-bold"
                          style={{ background: "rgba(239,68,68,0.12)", color: "var(--loss)" }}
                        >
                          STOP
                        </button>
                      ) : (
                        <button
                          className="px-2 py-0.5 text-[9px] font-bold"
                          style={{ background: "rgba(34,197,94,0.12)", color: "var(--profit)" }}
                        >
                          START
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail */}
        <div className="space-y-4">
          <div className="forge-panel p-4">
            <div className="flex items-center gap-2 mb-0.5">
              <div
                className="w-2.5 h-2.5"
                style={{ background: statusMap[selected.status]?.color }}
              />
              <h3 className="text-sm">{selected.name}</h3>
            </div>
            <div className="text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
              {selected.strategy} · {selected.pair} · {selected.exchange}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "SHARPE", value: metrics.sharpe.toFixed(2) },
                { label: "WIN RATE", value: `${metrics.winRate}%` },
                { label: "MAX DD", value: `${metrics.maxDrawdown}%`, color: "var(--loss)" },
                { label: "PF", value: metrics.profitFactor.toFixed(2) },
                { label: "RETURN", value: `${metrics.totalReturn}%`, color: "var(--profit)" },
                { label: "MODE", value: selected.mode.toUpperCase() },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-2"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-hard)" }}
                >
                  <div
                    className="text-[8px] tracking-wider font-bold"
                    style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
                  >
                    {m.label}
                  </div>
                  <div
                    className="text-xs tabular-nums font-bold"
                    style={{ color: m.color ?? "var(--text-primary)" }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="forge-panel p-3">
            <h3
              className="text-[9px] tracking-widest font-bold mb-2"
              style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
            >
              EQUITY CURVE
            </h3>
            <CandlestickChart data={candles.slice(-60)} height={150} />
          </div>
        </div>
      </div>
    </Theme4Frame>
  );
}
