"use client";

import { useSocket } from "@/providers/SocketProvider";

export function useWebSocket() {
  return useSocket();
}
