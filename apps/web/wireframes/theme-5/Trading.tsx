import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme5Frame } from "./components/ThemeFrame";

const orderBook = mockData.orderBook;
const candles = mockData.candles;
const positions = mockData.positions;
const openOrders = mockData.openOrders;

export default function Trading() {
  const latestClose = candles[candles.length - 1]?.close;
  const bestAsk = orderBook.asks[0];
  const bestBid = orderBook.bids[0];
  const spreadLabel =
    bestAsk && bestBid ? `Spread: $${(bestAsk.price - bestBid.price).toFixed(2)}` : "Spread: —";

  return (
    <Theme5Frame page="trading">
      <div className="grid grid-cols-4 gap-4">
        {/* Chart */}
        <div className="col-span-3 uv-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">BTC / USDT</span>
              <span className="text-xs tabular-nums" style={{ color: "var(--profit)" }}>
                {latestClose !== undefined ? `$${latestClose.toLocaleString()}` : "—"}
              </span>
              <span className="text-xs tabular-nums" style={{ color: "var(--profit)" }}>
                +2.34%
              </span>
            </div>
            <div className="flex gap-2">
              {["1m", "5m", "15m", "1H", "4H", "1D"].map((t) => (
                <button
                  key={t}
                  className="px-2.5 py-1 rounded-lg text-[11px]"
                  style={{
                    background: t === "15m" ? "var(--accent-dim)" : "transparent",
                    color: t === "15m" ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <CandlestickChart data={mockData.candles} height={340} />
        </div>

        {/* Order Book */}
        <div className="uv-card rounded-2xl p-5">
          <h3 className="text-xs font-semibold mb-3">Order Book</h3>
          <div className="space-y-0.5 text-[11px] font-mono">
            {/* Asks */}
            {orderBook.asks
              .slice(0, 9)
              .reverse()
              .map((a, i) => {
                const maxAmt = Math.max(...orderBook.asks.map((x) => x.amount));
                return (
                  <div key={`a-${i}`} className="relative flex justify-between py-0.5 px-1">
                    <div
                      className="absolute inset-0 right-0 opacity-10 rounded-sm"
                      style={{
                        width: `${(a.amount / maxAmt) * 100}%`,
                        background: "var(--loss)",
                        marginLeft: "auto",
                      }}
                    />
                    <span className="relative tabular-nums" style={{ color: "var(--loss)" }}>
                      {a.price.toLocaleString()}
                    </span>
                    <span className="relative tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {a.amount}
                    </span>
                  </div>
                );
              })}

            {/* Spread */}
            <div
              className="text-center py-1.5 my-1 rounded-lg text-[10px] font-medium"
              style={{
                background: "linear-gradient(90deg, rgba(168,85,247,0.1), rgba(236,72,153,0.1))",
                color: "var(--text-secondary)",
              }}
            >
              {spreadLabel}
            </div>

            {/* Bids */}
            {orderBook.bids.slice(0, 9).map((b, i) => {
              const maxAmt = Math.max(...orderBook.bids.map((x) => x.amount));
              return (
                <div key={`b-${i}`} className="relative flex justify-between py-0.5 px-1">
                  <div
                    className="absolute inset-0 opacity-10 rounded-sm"
                    style={{
                      width: `${(b.amount / maxAmt) * 100}%`,
                      background: "var(--profit)",
                    }}
                  />
                  <span className="relative tabular-nums" style={{ color: "var(--profit)" }}>
                    {b.price.toLocaleString()}
                  </span>
                  <span className="relative tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {b.amount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Order Form + Info */}
      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="col-span-2 uv-card rounded-2xl p-5">
          <div className="flex gap-3 mb-5">
            {["Limit", "Market", "Stop-Limit"].map((t) => (
              <button
                key={t}
                className="px-4 py-1.5 rounded-xl text-xs font-medium"
                style={{
                  background: t === "Limit" ? "var(--accent-dim)" : "transparent",
                  color: t === "Limit" ? "var(--accent)" : "var(--text-muted)",
                  border: t === "Limit" ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Buy side */}
            <div>
              <label className="text-[11px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Price (USDT)
              </label>
              <div
                className="rounded-xl px-3 py-2 text-sm tabular-nums mb-3"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
              >
                94,125.00
              </div>
              <label className="text-[11px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Amount (BTC)
              </label>
              <div
                className="rounded-xl px-3 py-2 text-sm tabular-nums mb-4"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
              >
                0.0500
              </div>
              <div className="flex gap-2 mb-4">
                {["25%", "50%", "75%", "100%"].map((pct) => (
                  <button
                    key={pct}
                    className="flex-1 py-1 rounded-lg text-[10px]"
                    style={{
                      background: "var(--bg-tertiary)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {pct}
                  </button>
                ))}
              </div>
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--profit)", color: "var(--bg-primary)" }}
              >
                Buy BTC
              </button>
            </div>
            {/* Sell side */}
            <div>
              <label className="text-[11px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Price (USDT)
              </label>
              <div
                className="rounded-xl px-3 py-2 text-sm tabular-nums mb-3"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
              >
                94,125.00
              </div>
              <label className="text-[11px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Amount (BTC)
              </label>
              <div
                className="rounded-xl px-3 py-2 text-sm tabular-nums mb-4"
                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}
              >
                0.0500
              </div>
              <div className="flex gap-2 mb-4">
                {["25%", "50%", "75%", "100%"].map((pct) => (
                  <button
                    key={pct}
                    className="flex-1 py-1 rounded-lg text-[10px]"
                    style={{
                      background: "var(--bg-tertiary)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {pct}
                  </button>
                ))}
              </div>
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--loss)", color: "white" }}
              >
                Sell BTC
              </button>
            </div>
          </div>
        </div>

        {/* Positions */}
        <div className="col-span-2 uv-card rounded-2xl p-5">
          <h3 className="text-xs font-semibold mb-3">Open Positions</h3>
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th className="text-left py-1.5 font-medium">Pair</th>
                <th className="text-left py-1.5 font-medium">Side</th>
                <th className="text-right py-1.5 font-medium">Size</th>
                <th className="text-right py-1.5 font-medium">Entry</th>
                <th className="text-right py-1.5 font-medium">uP&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="py-2">{p.symbol}</td>
                  <td
                    className="py-2 font-medium"
                    style={{ color: p.side === "long" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {p.side.toUpperCase()}
                  </td>
                  <td className="py-2 text-right tabular-nums">{p.size}</td>
                  <td className="py-2 text-right tabular-nums">${p.entryPrice.toLocaleString()}</td>
                  <td
                    className="py-2 text-right tabular-nums font-medium"
                    style={{ color: p.unrealizedPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="text-xs font-semibold mt-5 mb-3">Open Orders</h3>
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th className="text-left py-1.5 font-medium">Pair</th>
                <th className="text-left py-1.5 font-medium">Type</th>
                <th className="text-left py-1.5 font-medium">Side</th>
                <th className="text-right py-1.5 font-medium">Price</th>
                <th className="text-right py-1.5 font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              {openOrders.map((o, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="py-2">{o.symbol}</td>
                  <td className="py-2" style={{ color: "var(--text-muted)" }}>
                    {o.type}
                  </td>
                  <td
                    className="py-2 font-medium"
                    style={{ color: o.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {o.side.toUpperCase()}
                  </td>
                  <td className="py-2 text-right tabular-nums">${o.price.toLocaleString()}</td>
                  <td className="py-2 text-right tabular-nums">{o.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Theme5Frame>
  );
}
