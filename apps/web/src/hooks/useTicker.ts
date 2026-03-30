"use client";

import { useEffect } from "react";

import { trpc } from "@/lib/trpc";
import { useSocket } from "@/providers/SocketProvider";

export function useTicker(exchange: string, symbol: string) {
  const utils = trpc.useUtils();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !exchange || !symbol) {
      return;
    }

    socket.emit("subscribe", { type: "ticker", exchange, symbol });

    const handler = (data: {
      exchange: string;
      symbol: string;
      bid: number;
      ask: number;
      last: number;
      volume: number;
      change24h: number;
      timestamp: number;
    }) => {
      if (data.exchange === exchange && data.symbol === symbol) {
        utils.market.getTicker.setData({ exchange, symbol }, data);
      }
    };

    socket.on("price:ticker", handler);

    return () => {
      socket.emit("unsubscribe", { type: "ticker", exchange, symbol });
      socket.off("price:ticker", handler);
    };
  }, [socket, exchange, symbol, utils]);

  return trpc.market.getTicker.useQuery(
    { exchange, symbol },
    { staleTime: 5000, enabled: Boolean(exchange && symbol) }
  );
}
