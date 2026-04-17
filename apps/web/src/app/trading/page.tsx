"use client";

import { useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { toast } from "@/components/ui/Toaster";
import { useMarketData } from "@/hooks/useMarketData";
import { useOrderBook } from "@/hooks/useOrderBook";
import { useTicker } from "@/hooks/useTicker";
import { formatCurrency, formatNumber, pnlColor } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useUiStore } from "@/stores/ui";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

export default function TradingPage() {
  const selectedSymbol = useUiStore((s) => s.selectedSymbol);
  const selectedExchange = useUiStore((s) => s.selectedExchange);
  const [timeframe, setTimeframe] = useState("1h");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const placeOrder = trpc.trading.placeOrder.useMutation({
    onSuccess(data) {
      toast.success(`Order placed — ID: ${data.id}`);
      setOrderAmount("");
      setOrderPrice("");
    },
    onError(error) {
      toast.error(error.message);
      console.error("[placeOrder]", error);
    },
  });

  const { data: ticker } = useTicker(selectedExchange, selectedSymbol);
  const { data: candles } = useMarketData(selectedExchange, selectedSymbol, timeframe);
  const { data: orderBook, isLoading: orderBookLoading } = useOrderBook(
    selectedExchange,
    selectedSymbol,
    20
  );
  const lastPrice = ticker?.last ?? candles?.[candles.length - 1]?.close ?? 0;
  const slashIndex = selectedSymbol.indexOf("/");
  const baseAsset =
    slashIndex > 0 ? selectedSymbol.slice(0, slashIndex) : selectedSymbol || "Asset";
  const change24h = ticker?.change24h;
  const volume24h = ticker?.volume ?? 0;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl" style={{ color: "var(--text-primary)" }}>
            {selectedSymbol}
          </h1>
          {(ticker || lastPrice > 0) && (
            <div className="flex items-center gap-4 text-sm">
              <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(lastPrice)}
              </span>
              <span className="tabular-nums" style={{ color: pnlColor(change24h ?? 0) }}>
                {change24h !== undefined
                  ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`
                  : "—"}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Vol {formatNumber(volume24h, 0)}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="px-3 py-1 text-xs rounded-lg transition-colors"
              style={{
                color: tf === timeframe ? "var(--accent)" : "var(--text-muted)",
                background: tf === timeframe ? "var(--accent-dim)" : "transparent",
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Main Chart */}
        <div className="lg:col-span-3">
          <ErrorBoundary>
            <div className="glass-panel p-4">
              <CandlestickChart data={candles ?? []} height={500} />
            </div>
          </ErrorBoundary>
        </div>

        {/* Sidebar: Order Book + Order Form */}
        <div className="space-y-4">
          {/* Order Book */}
          <div className="glass-panel p-4">
            <h3 className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>
              Order Book
            </h3>
            {orderBookLoading ? (
              <div className="space-y-1">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 rounded animate-pulse"
                    style={{ background: "var(--bg-input)" }}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {/* Asks — show up to 5, reversed so lowest ask is closest to mid */}
                {(orderBook?.asks ?? [])
                  .slice(0, 5)
                  .reverse()
                  .map(([price, amount], i) => (
                    <div key={`ask-${i}`} className="flex justify-between text-xs tabular-nums">
                      <span style={{ color: "var(--loss)" }}>{formatCurrency(price)}</span>
                      <span style={{ color: "var(--text-muted)" }}>{amount.toFixed(4)}</span>
                    </div>
                  ))}
                {/* Spread / mid price */}
                <div
                  className="flex justify-center py-1 text-xs font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  {lastPrice > 0 ? formatCurrency(lastPrice) : "—"}
                </div>
                {/* Bids — show up to 5 */}
                {(orderBook?.bids ?? []).slice(0, 5).map(([price, amount], i) => (
                  <div key={`bid-${i}`} className="flex justify-between text-xs tabular-nums">
                    <span style={{ color: "var(--profit)" }}>{formatCurrency(price)}</span>
                    <span style={{ color: "var(--text-muted)" }}>{amount.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Form */}
          <div className="glass-panel p-4 space-y-3">
            <h3 className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Place Order
            </h3>

            <div className="flex gap-1">
              {(["buy", "sell"] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setOrderSide(side)}
                  className="flex-1 rounded-lg py-1.5 text-xs font-medium uppercase transition-colors"
                  style={{
                    background:
                      orderSide === side
                        ? side === "buy"
                          ? "rgba(74, 222, 128, 0.15)"
                          : "rgba(248, 113, 113, 0.15)"
                        : "var(--bg-input)",
                    color:
                      orderSide === side
                        ? side === "buy"
                          ? "var(--profit)"
                          : "var(--loss)"
                        : "var(--text-muted)",
                  }}
                >
                  {side}
                </button>
              ))}
            </div>

            <div className="flex gap-1">
              {(["market", "limit"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className="flex-1 rounded-lg py-1 text-xs capitalize transition-colors"
                  style={{
                    background: orderType === type ? "var(--accent-dim)" : "transparent",
                    color: orderType === type ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            {orderType === "limit" && (
              <div className="space-y-1">
                <label
                  htmlFor="trading-order-price"
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Price
                </label>
                <input
                  id="trading-order-price"
                  type="number"
                  step="0.01"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                />
              </div>
            )}

            <div className="space-y-1">
              <label
                htmlFor="trading-order-amount"
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Amount
              </label>
              <input
                id="trading-order-amount"
                type="number"
                step="0.0001"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              />
            </div>

            <button
              disabled={placeOrder.isPending || !selectedExchange || !selectedSymbol}
              onClick={() => {
                const parsedAmount = parseFloat(orderAmount);
                if (!parsedAmount || parsedAmount <= 0) {
                  toast.error("Amount must be greater than 0");
                  return;
                }

                if (orderType === "limit") {
                  const parsedPrice = parseFloat(orderPrice);
                  if (!parsedPrice || parsedPrice <= 0) {
                    toast.error("Price is required for limit orders");
                    return;
                  }
                  placeOrder.mutate({
                    exchange: selectedExchange,
                    symbol: selectedSymbol,
                    side: orderSide,
                    type: orderType,
                    amount: parsedAmount,
                    price: parsedPrice,
                  });
                } else {
                  placeOrder.mutate({
                    exchange: selectedExchange,
                    symbol: selectedSymbol,
                    side: orderSide,
                    type: orderType,
                    amount: parsedAmount,
                  });
                }
              }}
              className="w-full rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: orderSide === "buy" ? "var(--profit)" : "var(--loss)",
                color: "var(--primary-foreground)",
              }}
            >
              {placeOrder.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden="true"
                  />
                  Placing…
                </span>
              ) : (
                `${orderSide === "buy" ? "Buy" : "Sell"} ${baseAsset}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
