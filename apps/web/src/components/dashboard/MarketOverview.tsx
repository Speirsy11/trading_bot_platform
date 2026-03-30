"use client";

import { trpc } from "@/lib/trpc";

export function MarketOverview() {
  const { data: symbols } = trpc.market.getSymbols.useQuery({ exchange: "binance" });

  return (
    <div className="glass-panel p-5">
      <h2 className="text-lg mb-4">Market Overview</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="text-left py-2 font-normal text-xs">Symbol</th>
              <th className="text-right py-2 font-normal text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {(symbols ?? []).slice(0, 10).map((sym) => (
              <tr key={sym} className="border-t" style={{ borderColor: "var(--grid)" }}>
                <td className="py-2.5" style={{ color: "var(--text-primary)" }}>
                  {sym}
                </td>
                <td className="py-2.5 text-right text-xs" style={{ color: "var(--text-muted)" }}>
                  Available
                </td>
              </tr>
            ))}
            {(!symbols || symbols.length === 0) && (
              <tr>
                <td
                  colSpan={2}
                  className="py-8 text-center text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  No market data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
