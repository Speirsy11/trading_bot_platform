import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme2Frame } from "./components/ThemeFrame";

const statusStyle: Record<string, { indicator: string; color: string }> = {
  running: { indicator: "●", color: "var(--profit)" },
  stopped: { indicator: "■", color: "var(--loss)" },
  paused: { indicator: "▮▮", color: "#ffaa00" },
  error: { indicator: "✖", color: "#ff3333" },
};

export default function Bots() {
  const { bots, botMetrics, candles } = mockData;
  const selected = bots[0];
  const metrics = selected ? botMetrics[selected.id] : undefined;

  if (!selected || !metrics) {
    return (
      <Theme2Frame page="bots">
        <div
          className="crt-border p-4 text-[10px]"
          style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}
        >
          $ NO_BOT_DATA
        </div>
      </Theme2Frame>
    );
  }

  return (
    <Theme2Frame page="bots">
      {/* Filter */}
      <div
        className="flex items-center gap-3 mb-3 crt-border px-3 py-2"
        style={{ background: "var(--bg-card)" }}
      >
        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
          $ filter
        </span>
        {["--status=*", "--exchange=*", "--strategy=*"].map((f) => (
          <span
            key={f}
            className="text-[10px] px-2 py-0.5 crt-border"
            style={{ color: "var(--text-secondary)" }}
          >
            {f}
          </span>
        ))}
        <div className="ml-auto">
          <button
            className="px-3 py-1 text-[10px] font-bold"
            style={{ background: "var(--accent)", color: "#010a01" }}
          >
            $ NEW_BOT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Bot Table */}
        <div
          className="col-span-2 crt-border overflow-hidden"
          style={{ background: "var(--bg-card)" }}
        >
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: "var(--bg-secondary)" }}>
                {["#", "NAME", "STRATEGY", "PAIR", "XCHG", "STATUS", "PNL", "CMD"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-2 text-left text-[9px] font-normal"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bots.map((bot, i) => {
                const st = statusStyle[bot.status] ?? statusStyle.stopped!;
                const isSelected = bot.id === selected.id;
                return (
                  <tr
                    key={bot.id}
                    className="cursor-pointer"
                    style={{
                      background: isSelected ? "rgba(51,255,51,0.08)" : "transparent",
                      borderBottom: "1px solid rgba(51,255,51,0.05)",
                    }}
                  >
                    <td className="px-2 py-1.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {i + 1}
                    </td>
                    <td className="px-2 py-1.5">{bot.name}</td>
                    <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                      {bot.strategy}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{bot.pair}</td>
                    <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                      {bot.exchange}
                    </td>
                    <td className="px-2 py-1.5">
                      <span style={{ color: st.color }}>
                        {st.indicator} <span className="uppercase">{bot.status}</span>
                      </span>
                    </td>
                    <td
                      className="px-2 py-1.5 tabular-nums"
                      style={{ color: bot.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                    >
                      {bot.pnl >= 0 ? "+" : ""}
                      {bot.pnl.toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5">
                      {bot.status === "running" ? (
                        <span
                          className="text-[9px] px-1 py-px crt-border cursor-pointer"
                          style={{ color: "var(--loss)" }}
                        >
                          KILL
                        </span>
                      ) : (
                        <span
                          className="text-[9px] px-1 py-px crt-border cursor-pointer"
                          style={{ color: "var(--profit)" }}
                        >
                          RUN
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bot Detail */}
        <div className="space-y-3">
          <div className="crt-border p-3" style={{ background: "var(--bg-card)" }}>
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{ color: statusStyle[selected.status]?.color }}>
                {statusStyle[selected.status]?.indicator}
              </span>
              <span className="crt-glow text-sm">{selected.name}</span>
            </div>
            <div className="text-[9px] mb-3" style={{ color: "var(--text-muted)" }}>
              PID={selected.id} {selected.strategy} {selected.pair} @{selected.exchange}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "SHARPE", value: metrics.sharpe.toFixed(2) },
                { label: "WIN_RATE", value: `${metrics.winRate}%` },
                { label: "MAX_DD", value: `${metrics.maxDrawdown}%`, color: "var(--loss)" },
                { label: "PF", value: metrics.profitFactor.toFixed(2) },
                { label: "RETURN", value: `${metrics.totalReturn}%`, color: "var(--profit)" },
                { label: "MODE", value: selected.mode.toUpperCase() },
              ].map((m) => (
                <div
                  key={m.label}
                  className="crt-border px-2 py-1.5"
                  style={{ background: "var(--bg-input)" }}
                >
                  <div className="text-[8px]" style={{ color: "var(--text-muted)" }}>
                    {m.label}
                  </div>
                  <div
                    className="text-[11px] tabular-nums crt-glow"
                    style={{ color: m.color ?? "var(--text-primary)" }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="crt-border p-3" style={{ background: "var(--bg-card)" }}>
            <div className="text-[9px] mb-2" style={{ color: "var(--text-muted)" }}>
              EQUITY_CURVE
            </div>
            <CandlestickChart data={candles.slice(-60)} height={150} />
          </div>
        </div>
      </div>
    </Theme2Frame>
  );
}
