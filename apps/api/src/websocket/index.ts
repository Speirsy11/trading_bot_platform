import type { FastifyInstance } from "fastify";
import type IORedis from "ioredis";
import type { Server, Socket } from "socket.io";

const CHANNELS = [
  "market:ticker",
  "market:candle",
  "market:orderBook",
  "bot:status",
  "bot:trade",
  "bot:metrics",
  "portfolio:update",
  "backtest:progress",
  "data:status",
  "worker:error",
] as const;

export async function setupSocketHub(app: FastifyInstance, subscriber: IORedis) {
  if (!app.io || typeof app.io.on !== "function") {
    throw new Error("Socket.IO server is not available on the Fastify instance");
  }

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
      fanOut(io, app.log, channel, payload);
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
      return buildTickerRoom(payload);
    case "candle":
      return buildCandleRoom(payload);
    case "orderBook":
      return buildOrderBookRoom(payload);
    case "bot":
      return buildBotRoom(payload);
    case "portfolio":
      return "portfolio";
    case "backtest":
      return buildBacktestRoom(payload);
    case "trades:all":
      return "trades:all";
    default:
      return null;
  }
}

function fanOut(
  io: Server,
  logger: FastifyInstance["log"],
  channel: string,
  payload: Record<string, unknown>
) {
  switch (channel) {
    case "market:ticker": {
      const room = buildTickerRoom(payload);
      if (!room) {
        logger.warn({ channel, payload }, "dropping malformed websocket payload");
        return;
      }
      io.to(room).emit("price:ticker", payload);
      return;
    }
    case "market:candle": {
      const room = buildCandleRoom(payload);
      if (!room) {
        logger.warn({ channel, payload }, "dropping malformed websocket payload");
        return;
      }
      io.to(room).emit("price:candle", payload);
      return;
    }
    case "market:orderBook": {
      const room = buildOrderBookRoom(payload);
      if (!room) {
        logger.warn({ channel, payload }, "dropping malformed websocket payload");
        return;
      }
      io.to(room).emit("price:orderBook", payload);
      return;
    }
    case "bot:status":
    case "bot:trade":
    case "bot:metrics": {
      const room = buildBotRoom(payload);
      if (!room) {
        logger.warn({ channel, payload }, "dropping malformed websocket payload");
        return;
      }
      const eventName =
        channel === "bot:status"
          ? "bot:statusChange"
          : channel === "bot:trade"
            ? "bot:trade"
            : "bot:metrics";
      io.to(room).emit(eventName, payload);
      if (channel === "bot:trade") {
        io.to("trades:all").emit("bot:trade", payload);
      }
      return;
    }
    case "backtest:progress": {
      const room = buildBacktestRoom(payload);
      if (!room) {
        logger.warn({ channel, payload }, "dropping malformed websocket payload");
        return;
      }
      io.to(room).emit("backtest:progress", payload);
      return;
    }
    case "portfolio:update":
      io.to("portfolio").emit("portfolio:update", payload);
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

function buildTickerRoom(payload: Record<string, unknown>) {
  const exchange = getRequiredRoomField(payload, "exchange");
  const symbol = getRequiredRoomField(payload, "symbol");
  return exchange && symbol ? `ticker:${exchange}:${symbol}` : null;
}

function buildCandleRoom(payload: Record<string, unknown>) {
  const exchange = getRequiredRoomField(payload, "exchange");
  const symbol = getRequiredRoomField(payload, "symbol");
  const timeframe = getRequiredRoomField(payload, "timeframe");
  return exchange && symbol && timeframe ? `candle:${exchange}:${symbol}:${timeframe}` : null;
}

function buildOrderBookRoom(payload: Record<string, unknown>) {
  const exchange = getRequiredRoomField(payload, "exchange");
  const symbol = getRequiredRoomField(payload, "symbol");
  return exchange && symbol ? `orderBook:${exchange}:${symbol}` : null;
}

function buildBotRoom(payload: Record<string, unknown>) {
  const botId = getRequiredRoomField(payload, "botId");
  return botId ? `bot:${botId}` : null;
}

function buildBacktestRoom(payload: Record<string, unknown>) {
  const backtestId = getRequiredRoomField(payload, "backtestId");
  return backtestId ? `backtest:${backtestId}` : null;
}

function getRequiredRoomField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
