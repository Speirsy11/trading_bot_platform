"use client";

import { useEffect } from "react";

import { trpc } from "@/lib/trpc";
import { useSocket } from "@/providers/SocketProvider";

export function usePortfolio() {
  const utils = trpc.useUtils();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.emit("subscribe", { type: "portfolio" });

    const handler = (data: { totalValue: number; change24h: number }) => {
      utils.portfolio.getSummary.setData(undefined, (old) => (old ? { ...old, ...data } : old));
    };

    socket.on("portfolio:update", handler);

    return () => {
      socket.emit("unsubscribe", { type: "portfolio" });
      socket.off("portfolio:update", handler);
    };
  }, [socket, utils]);

  return trpc.portfolio.getSummary.useQuery();
}
