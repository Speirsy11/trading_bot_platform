"use client";

import { useEffect } from "react";

import { trpc } from "@/lib/trpc";
import { useSocket } from "@/providers/SocketProvider";

export function useOrderBook(exchange: string, symbol: string, limit = 20) {
  const utils = trpc.useUtils();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !exchange || !symbol) {
      return;
    }

    socket.emit("subscribe", { type: "orderBook", exchange, symbol });

    const handler = (data: {
      exchange: string;
      symbol: string;
      bids: [number, number][];
      asks: [number, number][];
      timestamp: number;
    }) => {
      if (data.exchange === exchange && data.symbol === symbol) {
        utils.market.getOrderBook.setData({ exchange, symbol, limit }, data);
      }
    };

    socket.on("price:orderBook", handler);

    return () => {
      socket.emit("unsubscribe", { type: "orderBook", exchange, symbol });
      socket.off("price:orderBook", handler);
    };
  }, [socket, exchange, symbol, limit, utils]);

  return trpc.market.getOrderBook.useQuery(
    { exchange, symbol, limit },
    { staleTime: 5000, enabled: Boolean(exchange && symbol) }
  );
}
