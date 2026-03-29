import { mockData } from "../shared/mock-data";

import { Theme5Frame } from "./components/ThemeFrame";

const bots = mockData.bots;
const botMetrics = mockData.botMetrics;

const statusColor: Record<string, string> = {
  running: "var(--profit)",
  paused: "var(--accent)",
  stopped: "var(--loss)",
  error: "var(--loss)",
};

export default function Bots() {
  const selectedBot = bots[0];
  const metrics = botMetrics[selectedBot.id];

  return (
    <Theme5Frame page="bots">
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {["All", "Active", "Paused", "Stopped"].map((f) => (
            <button
              key={f}
              className="px-4 py-1.5 rounded-xl text-xs font-medium"
              style={{
                background:
                  f === "All"
                    ? "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.1))"
                    : "transparent",
                color: f === "All" ? "var(--accent)" : "var(--text-muted)",
                border: f === "All" ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          className="px-5 py-2 rounded-xl text-xs font-semibold uv-glow"
          style={{
            background: "linear-gradient(135deg, #a855f7, #ec4899)",
            color: "white",
          }}
        >
          + New Bot
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Bot list */}
        <div className="col-span-2 uv-card rounded-2xl p-5">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th className="text-left py-2 font-medium">Bot</th>
                <th className="text-left py-2 font-medium">Pair</th>
                <th className="text-left py-2 font-medium">Strategy</th>
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-right py-2 font-medium">P&L</th>
                <th className="text-right py-2 font-medium">Trades</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => (
                <tr
                  key={bot.id}
                  className="cursor-pointer"
                  style={{
                    borderTop: "1px solid var(--border)",
                    background: bot.id === selectedBot.id ? "rgba(168,85,247,0.05)" : "transparent",
                  }}
                >
                  <td className="py-3 font-medium">{bot.name}</td>
                  <td className="py-3" style={{ color: "var(--text-secondary)" }}>
                    {bot.pair}
                  </td>
                  <td className="py-3" style={{ color: "var(--text-secondary)" }}>
                    {bot.strategy}
                  </td>
                  <td className="py-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: statusColor[bot.status] || "var(--text-muted)",
                          boxShadow:
                            bot.status === "running"
                              ? `0 0 6px ${statusColor[bot.status]}`
                              : "none",
                        }}
                      />
                      <span style={{ color: statusColor[bot.status] || "var(--text-muted)" }}>
                        {bot.status.charAt(0).toUpperCase() + bot.status.slice(1)}
                      </span>
                    </span>
                  </td>
                  <td
                    className="py-3 text-right tabular-nums font-medium"
                    style={{ color: bot.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {bot.pnl >= 0 ? "+" : ""}${bot.pnl.toFixed(2)}
                  </td>
                  <td className="py-3 text-right tabular-nums">{bot.pnlPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bot detail */}
        <div className="uv-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">{selectedBot.name}</h3>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: statusColor[selectedBot.status],
                boxShadow: `0 0 8px ${statusColor[selectedBot.status]}`,
              }}
            />
          </div>

          <div className="space-y-1 mb-5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <div className="flex justify-between">
              <span>Pair</span>
              <span>{selectedBot.pair}</span>
            </div>
            <div className="flex justify-between">
              <span>Strategy</span>
              <span>{selectedBot.strategy}</span>
            </div>
            <div className="flex justify-between">
              <span>Exchange</span>
              <span>{selectedBot.exchange}</span>
            </div>
            <div className="flex justify-between">
              <span>Mode</span>
              <span>{selectedBot.mode}</span>
            </div>
          </div>

          <div className="pt-4 mb-5" style={{ borderTop: "1px solid var(--border)" }}>
            <h4 className="text-[11px] font-medium mb-3" style={{ color: "var(--text-muted)" }}>
              Performance Metrics
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {metrics && (
                <>
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Sharpe Ratio
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {metrics.sharpe.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Win Rate
                    </div>
                    <div
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: "var(--profit)" }}
                    >
                      {metrics.winRate.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Max Drawdown
                    </div>
                    <div
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: "var(--loss)" }}
                    >
                      {metrics.maxDrawdown.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Profit Factor
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {metrics.profitFactor.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-2 mt-1">
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Total Return
                    </div>
                    <div className="text-lg font-bold uv-gradient-text">
                      {metrics.totalReturn >= 0 ? "+" : ""}
                      {metrics.totalReturn.toFixed(1)}%
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Equity curve placeholder */}
          <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <h4 className="text-[11px] font-medium mb-3" style={{ color: "var(--text-muted)" }}>
              Equity Curve
            </h4>
            <div
              className="h-24 rounded-xl overflow-hidden relative"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="uv-eq-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="50%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#06d6a0" />
                  </linearGradient>
                  <linearGradient id="uv-eq-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,45 L15,42 L30,38 L45,40 L60,32 L75,28 L90,30 L105,22 L120,18 L135,20 L150,14 L165,10 L180,12 L195,8 L200,6"
                  fill="none"
                  stroke="url(#uv-eq-grad)"
                  strokeWidth="2"
                />
                <path
                  d="M0,45 L15,42 L30,38 L45,40 L60,32 L75,28 L90,30 L105,22 L120,18 L135,20 L150,14 L165,10 L180,12 L195,8 L200,6 L200,60 L0,60Z"
                  fill="url(#uv-eq-fill)"
                />
              </svg>
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button
              className="flex-1 py-2 rounded-xl text-xs font-medium"
              style={{
                background: "var(--accent-dim)",
                color: "var(--accent)",
                border: "1px solid var(--border)",
              }}
            >
              Pause
            </button>
            <button
              className="flex-1 py-2 rounded-xl text-xs font-medium"
              style={{
                background: "rgba(255,77,106,0.1)",
                color: "var(--loss)",
                border: "1px solid rgba(255,77,106,0.15)",
              }}
            >
              Stop
            </button>
          </div>
        </div>
      </div>
    </Theme5Frame>
  );
}
