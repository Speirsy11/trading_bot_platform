"use client";

import { useEffect } from "react";

import { trpc } from "@/lib/trpc";
import { useSocket } from "@/providers/SocketProvider";

export function useBotStatus(botId: string) {
  const utils = trpc.useUtils();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.emit("subscribe", { type: "bot", botId });

    const onStatus = (data: { botId: string; status: string; timestamp: number }) => {
      if (data.botId === botId) {
        void utils.bots.getById.invalidate({ botId });
      }
    };
    const onTrade = (data: { botId: string }) => {
      if (data.botId === botId) {
        void utils.bots.getTrades.invalidate({ botId });
      }
    };
    const onMetrics = (data: { botId: string }) => {
      if (data.botId === botId) {
        void utils.bots.getMetrics.invalidate({ botId });
      }
    };

    socket.on("bot:statusChange", onStatus);
    socket.on("bot:trade", onTrade);
    socket.on("bot:metrics", onMetrics);

    return () => {
      socket.emit("unsubscribe", { type: "bot", botId });
      socket.off("bot:statusChange", onStatus);
      socket.off("bot:trade", onTrade);
      socket.off("bot:metrics", onMetrics);
    };
  }, [socket, botId, utils]);

  const query = trpc.bots.getById.useQuery({ botId });
  return query;
}
