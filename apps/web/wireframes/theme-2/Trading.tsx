import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme2Frame } from "./components/ThemeFrame";

export default function Trading() {
  const { candles, orderBook, openOrders, positions } = mockData;
  const maxBidTotal = orderBook.bids[orderBook.bids.length - 1]?.total ?? 1;
  const maxAskTotal = orderBook.asks[orderBook.asks.length - 1]?.total ?? 1;

  return (
    <Theme2Frame page="trading">
      <div className="grid grid-cols-4 gap-3">
        {/* Chart */}
        <div className="col-span-3 crt-border p-3" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px]">
              <span style={{ color: "var(--text-muted)" }}>$ chart --pair=</span>
              <span className="crt-glow">BTC/USDT</span>
              <span
                className="ml-3 crt-glow text-sm tabular-nums"
                style={{ color: "var(--profit)" }}
              >
                ${candles[candles.length - 1]?.close.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-1">
              {["1m", "5m", "15m", "1H", "4H", "1D"].map((tf) => (
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
          <CandlestickChart data={candles} height={400} />
        </div>

        {/* Order Book + Order Form */}
        <div className="space-y-3">
          {/* Order Book */}
          <div className="crt-border p-3" style={{ background: "var(--bg-card)" }}>
            <div className="text-[9px] mb-2" style={{ color: "var(--text-muted)" }}>
              ORDER_BOOK
            </div>
            <div
              className="text-[9px] grid grid-cols-3 gap-1 mb-1.5"
              style={{ color: "var(--text-muted)" }}
            >
              <span>PRICE</span>
              <span className="text-right">SIZE</span>
              <span className="text-right">TOTAL</span>
            </div>
            {/* Asks reversed */}
            <div className="space-y-px mb-1.5">
              {orderBook.asks
                .slice(0, 8)
                .reverse()
                .map((level, i) => (
                  <div
                    key={`a-${i}`}
                    className="relative grid grid-cols-3 gap-1 text-[10px] tabular-nums py-px"
                  >
                    <div
                      className="absolute inset-0 opacity-10"
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
            <div className="text-center text-[10px] py-1 crt-glow">
              ── {(orderBook.asks[0]!.price - orderBook.bids[0]!.price).toFixed(2)} ──
            </div>
            <div className="space-y-px mt-1.5">
              {orderBook.bids.slice(0, 8).map((level, i) => (
                <div
                  key={`b-${i}`}
                  className="relative grid grid-cols-3 gap-1 text-[10px] tabular-nums py-px"
                >
                  <div
                    className="absolute inset-0 opacity-10"
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
          <div className="crt-border p-3" style={{ background: "var(--bg-card)" }}>
            <div className="flex gap-1 mb-3">
              {["LIMIT", "MARKET"].map((type) => (
                <button
                  key={type}
                  className="flex-1 py-1 text-[10px] font-bold"
                  style={{
                    background: type === "LIMIT" ? "var(--accent)" : "transparent",
                    color: type === "LIMIT" ? "#010a01" : "var(--text-muted)",
                    border: type === "LIMIT" ? "none" : "1px solid var(--border)",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-[9px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                  PRICE_USDT
                </div>
                <input
                  readOnly
                  value="94125.00"
                  className="w-full px-2 py-1.5 text-[11px] tabular-nums outline-none crt-border"
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <div className="text-[9px] mb-0.5" style={{ color: "var(--text-muted)" }}>
                  QTY_BTC
                </div>
                <input
                  readOnly
                  value="0.10"
                  className="w-full px-2 py-1.5 text-[11px] tabular-nums outline-none crt-border"
                  style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {["25%", "50%", "75%", "MAX"].map((p) => (
                  <button
                    key={p}
                    className="py-0.5 text-[9px]"
                    style={{
                      background: "var(--bg-input)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                TOTAL: <span style={{ color: "var(--text-primary)" }}>$9,412.50</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  className="py-2 text-[10px] font-bold"
                  style={{ background: "var(--profit)", color: "#010a01" }}
                >
                  BUY
                </button>
                <button
                  className="py-2 text-[10px] font-bold"
                  style={{ background: "var(--loss)", color: "#010a01" }}
                >
                  SELL
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Positions + Orders */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="crt-border overflow-hidden" style={{ background: "var(--bg-card)" }}>
          <div
            className="px-3 py-2 text-[9px]"
            style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}
          >
            OPEN_POSITIONS
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: "var(--bg-secondary)" }}>
                {["PAIR", "SIDE", "SIZE", "ENTRY", "MARK", "UPNL"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1.5 text-left text-[9px] font-normal"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id} style={{ borderBottom: "1px solid rgba(51,255,51,0.05)" }}>
                  <td className="px-2 py-1.5">{pos.symbol}</td>
                  <td
                    className="px-2 py-1.5 uppercase"
                    style={{ color: pos.side === "long" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {pos.side}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{pos.size}</td>
                  <td className="px-2 py-1.5 tabular-nums">${pos.entryPrice.toLocaleString()}</td>
                  <td className="px-2 py-1.5 tabular-nums">${pos.markPrice.toLocaleString()}</td>
                  <td
                    className="px-2 py-1.5 tabular-nums crt-glow"
                    style={{ color: pos.unrealizedPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="crt-border overflow-hidden" style={{ background: "var(--bg-card)" }}>
          <div
            className="px-3 py-2 text-[9px]"
            style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}
          >
            PENDING_ORDERS
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: "var(--bg-secondary)" }}>
                {["PAIR", "SIDE", "TYPE", "PRICE", "QTY", "STATUS"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1.5 text-left text-[9px] font-normal"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {openOrders.map((order) => (
                <tr key={order.id} style={{ borderBottom: "1px solid rgba(51,255,51,0.05)" }}>
                  <td className="px-2 py-1.5">{order.symbol}</td>
                  <td
                    className="px-2 py-1.5 uppercase"
                    style={{ color: order.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {order.side}
                  </td>
                  <td className="px-2 py-1.5 uppercase">{order.type}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {order.price > 0 ? `$${order.price.toLocaleString()}` : "MKT"}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{order.amount}</td>
                  <td
                    className="px-2 py-1.5 uppercase text-[9px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    [{order.status}]
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
