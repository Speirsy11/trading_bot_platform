import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

const DEFAULT_API_URL = "http://localhost:3001";

export function getSocket(): Socket {
  if (!socket) {
    socket = io(
      process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL,
      {
        autoConnect: false,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      }
    );
  }
  return socket;
}
