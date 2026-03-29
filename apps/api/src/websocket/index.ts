import type { FastifyInstance } from "fastify";
import type IORedis from "ioredis";
import type { Server, Socket } from "socket.io";

const CHANNELS = [
  "market:ticker",
  "market:candle",
  "bot:status",
  "bot:trade",
  "bot:metrics",
  "portfolio:update",
  "backtest:progress",
  "data:status",
  "worker:error",
] as const;

export async function setupSocketHub(app: FastifyInstance, subscriber: IORedis) {
  const io = app.io as Server;

  io.on("connection", (socket: Socket) => {
    socket.emit("system:connected", { connectedAt: Date.now() });
    socket.on("subscribe", (payload: Record<string, unknown>) =>
      handleSubscription(socket, payload, "join")
    );
    socket.on("unsubscribe", (payload: Record<string, unknown>) =>
      handleSubscription(socket, payload, "leave")
    );
  });

  await subscriber.subscribe(...CHANNELS);

  const onMessage = (channel: string, raw: string) => {
    try {
      const payload = JSON.parse(raw) as Record<string, unknown>;
      fanOut(io, channel, payload);
    } catch (error) {
      app.log.warn({ channel, error }, "failed to fan out websocket event");
    }
  };

  subscriber.on("message", onMessage);

  app.addHook("onClose", async () => {
    subscriber.off("message", onMessage);
    await subscriber.unsubscribe(...CHANNELS);
  });
}

function handleSubscription(
  socket: Socket,
  payload: Record<string, unknown>,
  action: "join" | "leave"
) {
  const room = resolveRoom(payload);
  if (!room) {
    return;
  }

  if (action === "join") {
    void socket.join(room);
  } else {
    void socket.leave(room);
  }
}

function resolveRoom(payload: Record<string, unknown>) {
  switch (payload.type) {
    case "ticker":
      return `ticker:${payload.exchange}:${payload.symbol}`;
    case "candle":
      return `candle:${payload.exchange}:${payload.symbol}:${payload.timeframe}`;
    case "bot":
      return `bot:${payload.botId}`;
    case "portfolio":
      return "portfolio";
    case "backtest":
      return `backtest:${payload.backtestId}`;
    default:
      return null;
  }
}

function fanOut(io: Server, channel: string, payload: Record<string, unknown>) {
  switch (channel) {
    case "market:ticker":
      io.to(`ticker:${payload.exchange}:${payload.symbol}`).emit("price:ticker", payload);
      return;
    case "market:candle":
      io.to(`candle:${payload.exchange}:${payload.symbol}:${payload.timeframe}`).emit(
        "price:candle",
        payload
      );
      return;
    case "bot:status":
      io.to(`bot:${payload.botId}`).emit("bot:statusChange", payload);
      return;
    case "bot:trade":
      io.to(`bot:${payload.botId}`).emit("bot:trade", payload);
      return;
    case "bot:metrics":
      io.to(`bot:${payload.botId}`).emit("bot:metrics", payload);
      return;
    case "portfolio:update":
      io.to("portfolio").emit("portfolio:update", payload);
      return;
    case "backtest:progress":
      io.to(`backtest:${payload.backtestId}`).emit("backtest:progress", payload);
      return;
    case "data:status":
      io.emit("data:collectionStatus", payload);
      return;
    case "worker:error":
      io.emit("system:error", payload);
      return;
    default:
      return;
  }
}
