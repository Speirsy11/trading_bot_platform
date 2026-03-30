import { CandlestickChart } from "../shared/components/CandlestickChart";
import { mockData } from "../shared/mock-data";

import { Theme4Frame } from "./components/ThemeFrame";

export default function Trading() {
  const { candles, orderBook, openOrders, positions } = mockData;
  const maxBidTotal = orderBook.bids[orderBook.bids.length - 1]?.total ?? 1;
  const maxAskTotal = orderBook.asks[orderBook.asks.length - 1]?.total ?? 1;
  const latestClose = candles[candles.length - 1]?.close;
  const bestAsk = orderBook.asks[0];
  const bestBid = orderBook.bids[0];
  const spreadLabel =
    bestAsk && bestBid ? `SPREAD ${(bestAsk.price - bestBid.price).toFixed(2)}` : "SPREAD —";

  return (
    <Theme4Frame page="trading">
      <div className="grid grid-cols-4 gap-4">
        {/* Chart */}
        <div className="col-span-3 forge-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <h2 className="text-base">BTC / USDT</h2>
              <span className="text-lg font-bold tabular-nums" style={{ color: "var(--profit)" }}>
                {latestClose !== undefined ? `$${latestClose.toLocaleString()}` : "—"}
              </span>
            </div>
            <div className="flex gap-1">
              {["1m", "5m", "15m", "1H", "4H", "1D"].map((tf) => (
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
          <CandlestickChart data={candles} height={400} />
        </div>

        {/* Order Book + Form */}
        <div className="space-y-4">
          <div className="forge-panel p-3">
            <h3
              className="text-[10px] tracking-widest mb-2"
              style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
            >
              BOOK
            </h3>
            <div
              className="text-[9px] grid grid-cols-3 gap-1 mb-1.5 tracking-wider"
              style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
            >
              <span>PRICE</span>
              <span className="text-right">SIZE</span>
              <span className="text-right">TOTAL</span>
            </div>
            <div className="space-y-px mb-1.5">
              {orderBook.asks
                .slice(0, 8)
                .reverse()
                .map((level, i) => (
                  <div
                    key={`a-${i}`}
                    className="relative grid grid-cols-3 gap-1 text-[10px] tabular-nums py-0.5"
                  >
                    <div
                      className="absolute inset-0 opacity-15"
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
            <div
              className="text-center text-[10px] py-1 font-bold"
              style={{ color: "var(--accent)" }}
            >
              {spreadLabel}
            </div>
            <div className="space-y-px mt-1.5">
              {orderBook.bids.slice(0, 8).map((level, i) => (
                <div
                  key={`b-${i}`}
                  className="relative grid grid-cols-3 gap-1 text-[10px] tabular-nums py-0.5"
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

          <div className="forge-panel p-3">
            <div className="flex gap-1 mb-3">
              {["LIMIT", "MARKET"].map((type) => (
                <button
                  key={type}
                  className="flex-1 py-1.5 text-[10px] font-bold tracking-wider"
                  style={{
                    color: type === "LIMIT" ? "#111" : "var(--text-muted)",
                    background: type === "LIMIT" ? "var(--accent)" : "transparent",
                    border: type === "MARKET" ? "2px solid var(--border-hard)" : "none",
                    fontFamily: "'Tektur', sans-serif",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <div>
                <div
                  className="text-[9px] tracking-wider mb-0.5"
                  style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
                >
                  PRICE
                </div>
                <input
                  readOnly
                  value="94,125.00"
                  className="w-full px-2 py-1.5 text-xs tabular-nums outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "2px solid var(--border-hard)",
                  }}
                />
              </div>
              <div>
                <div
                  className="text-[9px] tracking-wider mb-0.5"
                  style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
                >
                  AMOUNT
                </div>
                <input
                  readOnly
                  value="0.10"
                  className="w-full px-2 py-1.5 text-xs tabular-nums outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "2px solid var(--border-hard)",
                  }}
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {["25%", "50%", "75%", "MAX"].map((p) => (
                  <button
                    key={p}
                    className="py-1 text-[9px] font-bold"
                    style={{
                      background: "var(--bg-input)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-hard)",
                      fontFamily: "'Tektur', sans-serif",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                TOTAL:{" "}
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                  $9,412.50
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  className="py-2.5 text-xs font-black"
                  style={{
                    background: "var(--profit)",
                    color: "#111",
                    fontFamily: "'Tektur', sans-serif",
                  }}
                >
                  BUY
                </button>
                <button
                  className="py-2.5 text-xs font-black"
                  style={{
                    background: "var(--loss)",
                    color: "#111",
                    fontFamily: "'Tektur', sans-serif",
                  }}
                >
                  SELL
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="forge-panel-flat overflow-hidden">
          <div
            className="px-3 py-2 text-[9px] tracking-widest font-bold border-b-2"
            style={{
              borderColor: "var(--border-hard)",
              background: "var(--bg-secondary)",
              fontFamily: "'Tektur', sans-serif",
              color: "var(--text-muted)",
            }}
          >
            POSITIONS
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr
                style={{
                  background: "var(--bg-secondary)",
                  borderBottom: "1px solid var(--border-hard)",
                }}
              >
                {["PAIR", "SIDE", "SIZE", "ENTRY", "MARK", "UPNL"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1.5 text-left text-[9px] font-bold tracking-wider"
                    style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id} style={{ borderBottom: "1px solid var(--border-hard)" }}>
                  <td className="px-2 py-1.5 font-semibold">{pos.symbol}</td>
                  <td
                    className="px-2 py-1.5 uppercase font-bold"
                    style={{ color: pos.side === "long" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {pos.side}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{pos.size}</td>
                  <td className="px-2 py-1.5 tabular-nums">${pos.entryPrice.toLocaleString()}</td>
                  <td className="px-2 py-1.5 tabular-nums">${pos.markPrice.toLocaleString()}</td>
                  <td
                    className="px-2 py-1.5 tabular-nums font-bold"
                    style={{ color: pos.unrealizedPnl >= 0 ? "var(--profit)" : "var(--loss)" }}
                  >
                    {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="forge-panel-flat overflow-hidden">
          <div
            className="px-3 py-2 text-[9px] tracking-widest font-bold border-b-2"
            style={{
              borderColor: "var(--border-hard)",
              background: "var(--bg-secondary)",
              fontFamily: "'Tektur', sans-serif",
              color: "var(--text-muted)",
            }}
          >
            ORDERS
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr
                style={{
                  background: "var(--bg-secondary)",
                  borderBottom: "1px solid var(--border-hard)",
                }}
              >
                {["PAIR", "SIDE", "TYPE", "PRICE", "QTY", "STATUS"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1.5 text-left text-[9px] font-bold tracking-wider"
                    style={{ color: "var(--text-muted)", fontFamily: "'Tektur', sans-serif" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {openOrders.map((order) => (
                <tr key={order.id} style={{ borderBottom: "1px solid var(--border-hard)" }}>
                  <td className="px-2 py-1.5 font-semibold">{order.symbol}</td>
                  <td
                    className="px-2 py-1.5 uppercase font-bold"
                    style={{ color: order.side === "buy" ? "var(--profit)" : "var(--loss)" }}
                  >
                    {order.side}
                  </td>
                  <td className="px-2 py-1.5 uppercase">{order.type}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {order.price > 0 ? `$${order.price.toLocaleString()}` : "MKT"}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{order.amount}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className="text-[9px] px-1.5 py-px font-bold uppercase tracking-wider"
                      style={{
                        background: "var(--accent-dim)",
                        color: "var(--accent)",
                        fontFamily: "'Tektur', sans-serif",
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
    </Theme4Frame>
  );
}
