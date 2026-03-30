import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme1Frame } from "./components/ThemeFrame";

const statusColors: Record<string, { bg: string; dot: string; text: string }> = {
  running: { bg: "rgba(110,231,160,0.10)", dot: "var(--profit)", text: "var(--profit)" },
  stopped: { bg: "rgba(248,113,113,0.10)", dot: "var(--loss)", text: "var(--loss)" },
  paused: { bg: "rgba(200,165,90,0.10)", dot: "var(--accent)", text: "var(--accent)" },
  error: { bg: "rgba(248,113,113,0.15)", dot: "#ef4444", text: "#ef4444" },
};

export default function Bots() {
  const { bots, botMetrics, candles } = mockData;
  const selected = bots[0];
  const metrics = selected ? botMetrics[selected.id] : undefined;

  if (!selected || !metrics) {
    return (
      <Theme1Frame page="bots">
        <div
          className="rounded border p-6 text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-muted)",
          }}
        >
          No bot data available.
        </div>
      </Theme1Frame>
    );
  }

  return (
    <Theme1Frame page="bots">
      {/* Filter Bar */}
      <div
        className="flex items-center gap-3 mb-6 p-4 rounded border"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Filters
        </span>
        {["All Status", "All Exchanges", "All Strategies"].map((filter) => (
          <select
            key={filter}
            className="px-3 py-1.5 rounded text-xs outline-none"
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
            className="px-4 py-1.5 text-xs font-medium rounded"
            style={{ background: "var(--accent)", color: "#08080a" }}
          >
            + New Bot
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Bot Table */}
        <div
          className="col-span-2 rounded border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-card)" }}>
                {["Bot", "Strategy", "Pair", "Exchange", "Status", "PnL", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bots.map((bot, i) => {
                const st = statusColors[bot.status] ?? statusColors.stopped!;
                return (
                  <tr
                    key={bot.id}
                    className="transition-colors cursor-pointer"
                    style={{
                      background:
                        bot.id === selected.id
                          ? "var(--accent-dim)"
                          : i % 2 === 0
                            ? "var(--bg-secondary)"
                            : "var(--bg-card)",
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-xs">{bot.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {bot.strategy}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">{bot.pair}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {bot.exchange}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full capitalize"
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
                            className="px-2 py-0.5 text-[10px] rounded"
                            style={{ background: "rgba(248,113,113,0.12)", color: "var(--loss)" }}
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            className="px-2 py-0.5 text-[10px] rounded"
                            style={{ background: "rgba(110,231,160,0.12)", color: "var(--profit)" }}
                          >
                            Start
                          </button>
                        )}
                        <button
                          className="px-2 py-0.5 text-[10px] rounded"
                          style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
                        >
                          Config
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
          <div
            className="rounded border p-5"
            style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: statusColors[selected.status]?.dot }}
              />
              <h3
                className="text-base"
                style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
              >
                {selected.name}
              </h3>
            </div>
            <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              {selected.strategy} · {selected.pair} · {selected.exchange}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Sharpe", value: metrics.sharpe.toFixed(2) },
                { label: "Win Rate", value: `${metrics.winRate}%` },
                { label: "Max DD", value: `${metrics.maxDrawdown}%`, color: "var(--loss)" },
                { label: "Profit Factor", value: metrics.profitFactor.toFixed(2) },
                { label: "Total Return", value: `${metrics.totalReturn}%`, color: "var(--profit)" },
                { label: "Mode", value: selected.mode.toUpperCase() },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-2.5 rounded"
                  style={{ background: "var(--bg-input)" }}
                >
                  <div
                    className="text-[10px] uppercase tracking-wider mb-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {m.label}
                  </div>
                  <div
                    className="text-sm tabular-nums font-medium"
                    style={{ color: m.color ?? "var(--text-primary)" }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mini Equity Curve */}
          <div
            className="rounded border p-4"
            style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
          >
            <h3
              className="text-sm mb-3"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Equity Curve
            </h3>
            <CandlestickChart data={candles.slice(-60)} height={160} />
          </div>
        </div>
      </div>
    </Theme1Frame>
  );
}
