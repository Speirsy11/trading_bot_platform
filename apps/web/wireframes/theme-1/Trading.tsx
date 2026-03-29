import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme1Frame } from "./components/ThemeFrame";

export default function Trading() {
  const { candles, orderBook, openOrders, positions } = mockData;
  const maxBidTotal = orderBook.bids[orderBook.bids.length - 1]?.total ?? 1;
  const maxAskTotal = orderBook.asks[orderBook.asks.length - 1]?.total ?? 1;

  return (
    <Theme1Frame page="trading">
      <div className="grid grid-cols-4 gap-5">
        {/* Chart */}
        <div
          className="col-span-3 rounded border p-5"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg">BTC / USDT</h2>
              <span className="text-xl tabular-nums" style={{ color: "var(--profit)" }}>
                ${candles[candles.length - 1]?.close.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-1.5">
              {["1m", "5m", "15m", "1H", "4H", "1D"].map((tf) => (
                <button
                  key={tf}
                  className="px-2.5 py-1 text-xs rounded"
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
          <CandlestickChart data={candles} height={420} />
        </div>

        {/* Order Book + Order Form */}
        <div className="space-y-5">
          {/* Order Book */}
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
              Order Book
            </h3>
            <div
              className="text-[11px] grid grid-cols-3 gap-2 mb-2 uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              <span>Price</span>
              <span className="text-right">Size</span>
              <span className="text-right">Total</span>
            </div>
            {/* Asks (reversed) */}
            <div className="space-y-px mb-2">
              {orderBook.asks
                .slice(0, 8)
                .reverse()
                .map((level, i) => (
                  <div
                    key={`a-${i}`}
                    className="relative grid grid-cols-3 gap-2 text-[11px] tabular-nums py-0.5"
                  >
                    <div
                      className="absolute inset-0 right-0 opacity-15"
                      style={{
                        background: "var(--loss)",
                        width: `${(level.total / maxAskTotal) * 100}%`,
                        marginLeft: "auto",
                      }}
                    />
                    <span className="relative" style={{ color: "var(--loss)" }}>
                      {level.price.toLocaleString()}
                    </span>
                    <span className="relative text-right">{level.amount}</span>
                    <span className="relative text-right" style={{ color: "var(--text-muted)" }}>
                      {level.total}
                    </span>
                  </div>
                ))}
            </div>
            {/* Spread */}
            <div
              className="text-center text-xs py-1.5 font-medium"
              style={{ color: "var(--accent)" }}
            >
              {(orderBook.asks[0]!.price - orderBook.bids[0]!.price).toFixed(2)} spread
            </div>
            {/* Bids */}
            <div className="space-y-px mt-2">
              {orderBook.bids.slice(0, 8).map((level, i) => (
                <div
                  key={`b-${i}`}
                  className="relative grid grid-cols-3 gap-2 text-[11px] tabular-nums py-0.5"
                >
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{
                      background: "var(--profit)",
                      width: `${(level.total / maxBidTotal) * 100}%`,
                      marginLeft: "auto",
                    }}
                  />
                  <span className="relative" style={{ color: "var(--profit)" }}>
                    {level.price.toLocaleString()}
                  </span>
                  <span className="relative text-right">{level.amount}</span>
                  <span className="relative text-right" style={{ color: "var(--text-muted)" }}>
                    {level.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Form */}
          <div
            className="rounded border p-4"
            style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
          >
            <div className="flex gap-2 mb-4">
              {["Limit", "Market"].map((type) => (
                <button
                  key={type}
                  className="flex-1 py-1.5 text-xs rounded font-medium"
                  style={{
                    background: type === "Limit" ? "var(--accent-dim)" : "transparent",
                    color: type === "Limit" ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <div>
                <label
                  className="text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Price (USDT)
                </label>
                <input
                  readOnly
                  value="94,125.00"
                  className="w-full px-3 py-2 rounded text-sm tabular-nums outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                />
              </div>
              <div>
                <label
                  className="text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Amount (BTC)
                </label>
                <input
                  readOnly
                  value="0.10"
                  className="w-full px-3 py-2 rounded text-sm tabular-nums outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {["25%", "50%", "75%", "100%"].map((pct) => (
                  <button
                    key={pct}
                    className="py-1 text-[10px] rounded"
                    style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}
                  >
                    {pct}
                  </button>
                ))}
              </div>
              <div className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                Total: <span style={{ color: "var(--text-primary)" }}>$9,412.50</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="py-2.5 rounded text-sm font-medium"
                  style={{ background: "var(--profit)", color: "#08080a" }}
                >
                  Buy
                </button>
                <button
                  className="py-2.5 rounded text-sm font-medium"
                  style={{ background: "var(--loss)", color: "#08080a" }}
                >
                  Sell
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Positions + Open Orders */}
      <div className="grid grid-cols-2 gap-5 mt-5">
        {/* Positions */}
        <div className="rounded border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div
            className="px-4 py-3 text-xs uppercase tracking-wider font-medium"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}
          >
            Open Positions
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-card)" }}>
                {["Symbol", "Side", "Size", "Entry", "Mark", "uPnL"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos, i) => (
                <tr
                  key={pos.id}
                  style={{ background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--bg-card)" }}
                >
                  <td className="px-3 py-2 text-xs">{pos.symbol}</td>
                  <td
                    className="px-3 py-2 text-xs uppercase"
                    style={{ color: pos.side === "long" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {pos.side}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">{pos.size}</td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    ${pos.entryPrice.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    ${pos.markPrice.toLocaleString()}
                  </td>
                  <td
                    className="px-3 py-2 text-xs tabular-nums font-medium"
                    style={{ color: pos.unrealizedPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Open Orders */}
        <div className="rounded border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div
            className="px-4 py-3 text-xs uppercase tracking-wider font-medium"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}
          >
            Open Orders
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-card)" }}>
                {["Symbol", "Side", "Type", "Price", "Amount", "Status"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {openOrders.map((order, i) => (
                <tr
                  key={order.id}
                  style={{ background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--bg-card)" }}
                >
                  <td className="px-3 py-2 text-xs">{order.symbol}</td>
                  <td
                    className="px-3 py-2 text-xs uppercase"
                    style={{ color: order.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {order.side}
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">{order.type}</td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {order.price > 0 ? `$${order.price.toLocaleString()}` : "Market"}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">{order.amount}</td>
                  <td className="px-3 py-2">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                      style={{
                        background:
                          order.status === "pending"
                            ? "var(--accent-dim)"
                            : "rgba(110, 231, 160, 0.12)",
                        color: order.status === "pending" ? "var(--accent)" : "var(--profit)",
                      }}
                    >
                      {order.status}
                    </span>
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
