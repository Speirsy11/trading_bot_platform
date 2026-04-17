import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { bots, exchangeConfigs, type Database } from "@tb/db";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { and, eq, inArray, sql } from "drizzle-orm";
import Fastify, {
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import type IORedis from "ioredis";
import { Server } from "socket.io";

const API_VERSION = resolveApiVersion();

function resolveApiVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // src/app.ts -> ../package.json; dist/app.js -> ../package.json
    for (const candidate of ["../package.json", "../../package.json"]) {
      try {
        const raw = readFileSync(resolve(here, candidate), "utf8");
        const parsed = JSON.parse(raw) as { name?: string; version?: string };
        if (parsed.name === "api" && typeof parsed.version === "string") {
          return parsed.version;
        }
      } catch {
        // try next candidate
      }
    }
  } catch {
    // fall through
  }
  return process.env["npm_package_version"] ?? "0.0.0";
}

import type { QueueSet } from "./queues/index";
import type { ExchangeManager } from "./services/exchangeManager";
import type { KeyVault } from "./services/keyVault";
import { createTrpcContext } from "./trpc/context";
import { appRouter } from "./trpc/router";
import { parseAllowedOrigins } from "./utils/cors";
import { metricsRegistry } from "./utils/metrics";
import { setupSocketHub } from "./websocket/index";

interface CreateAppOptions {
  db: Database;
  redis: IORedis;
  subscriber: IORedis;
  queues: QueueSet;
  exchangeManager: ExchangeManager;
  keyVault: KeyVault;
  exportsDir: string;
  enableBullBoard?: boolean;
  bullBoardAuth?: {
    username: string;
    password: string;
  };
  loggerOptions?: FastifyServerOptions["logger"];
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({
    logger: options.loggerOptions ?? true,
    genReqId: () => randomUUID(),
  });

  const allowedOrigins = parseAllowedOrigins(process.env["CORS_ORIGINS"], process.env["NODE_ENV"]);

  await app.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: true,
  });

  const rateLimitRedis =
    typeof options.redis.duplicate === "function"
      ? options.redis.duplicate({
          connectTimeout: 1000,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        })
      : null;

  let rateLimitOptions: Record<string, unknown> = {
    max: Number(process.env["RATE_LIMIT_MAX"] ?? 300),
    timeWindow: 60_000,
    keyGenerator: (req: { ip: string }) => req.ip,
    errorResponseBuilder: () => ({
      error: "RATE_LIMITED",
      message: "Too many requests",
    }),
  };

  if (rateLimitRedis) {
    try {
      await rateLimitRedis.connect();
      rateLimitOptions = {
        ...rateLimitOptions,
        nameSpace: "api-rate-limit-",
        redis: rateLimitRedis,
      };
    } catch (error) {
      app.log.warn({ error }, "rate-limit redis unavailable, falling back to in-memory store");
      await rateLimitRedis.quit().catch(() => undefined);
    }
  } else {
    app.log.warn("rate-limit redis duplicate unavailable, falling back to in-memory store");
  }

  await app.register(fastifyRateLimit, rateLimitOptions);

  await app.register(fastifyStatic, {
    root: resolve(options.exportsDir),
    prefix: "/exports/",
    decorateReply: false,
  });

  const io = new Server(app.server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });
  app.decorate("io", io);

  await setupSocketHub(app, options.subscriber);
  app.addHook("onClose", async () => {
    await io.close();
    if (
      rateLimitRedis &&
      (rateLimitRedis.status === "ready" || rateLimitRedis.status === "connecting")
    ) {
      await rateLimitRedis.quit().catch(() => undefined);
    }
  });

  app.get("/", async () => ({ message: "Trading Bot API" }));
  app.get("/health", async (_request, reply) => {
    const [dbResult, redisResult] = await Promise.allSettled([
      options.db.execute(sql`select 1`),
      options.redis.ping(),
    ]);

    const db: "ok" | "error" = dbResult.status === "fulfilled" ? "ok" : "error";
    const redis: "ok" | "error" =
      redisResult.status === "fulfilled" && redisResult.value === "PONG" ? "ok" : "error";

    const errors: string[] = [];
    if (dbResult.status === "rejected") {
      errors.push(
        `db: ${dbResult.reason instanceof Error ? dbResult.reason.message : String(dbResult.reason)}`
      );
    } else if (redisResult.status === "fulfilled" && redis === "error") {
      // ping resolved but returned something other than PONG
      errors.push(`redis: unexpected ping response ${String(redisResult.value)}`);
    }
    if (redisResult.status === "rejected") {
      errors.push(
        `redis: ${redisResult.reason instanceof Error ? redisResult.reason.message : String(redisResult.reason)}`
      );
    }

    const healthy = db === "ok" && redis === "ok";
    if (!healthy) {
      reply.code(503);
      return {
        status: "degraded" as const,
        db,
        redis,
        uptime: process.uptime(),
        version: API_VERSION,
        ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
      };
    }

    return {
      status: "ok" as const,
      db,
      redis,
      uptime: process.uptime(),
      version: API_VERSION,
    };
  });

  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return metricsRegistry.metrics();
  });

  app.post("/emergency-stop", async (request, reply) => {
    // Require bearer token — same token used by tRPC protectedProcedure
    const expectedToken = process.env["API_AUTH_TOKEN"]?.trim();
    const authorization = request.headers.authorization;
    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : undefined;
    const headerToken =
      typeof request.headers["x-api-token"] === "string"
        ? (request.headers["x-api-token"] as string).trim()
        : undefined;
    const providedToken = bearerToken ?? headerToken;

    if (!expectedToken || !providedToken || providedToken !== expectedToken) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    // 1. Find all running live bots
    const liveBots = await options.db
      .select()
      .from(bots)
      .where(and(eq(bots.status, "running"), eq(bots.mode, "live")));

    const errors: string[] = [];
    let cancelledOrders = 0;

    if (liveBots.length === 0) {
      return { stoppedBots: 0, cancelledOrders: 0, errors: [] };
    }

    // 2. Batch-update all running live bots to "stopped"
    const botIds = liveBots.map((b) => b.id);
    await options.db
      .update(bots)
      .set({ status: "stopped", stoppedAt: new Date(), updatedAt: new Date() })
      .where(inArray(bots.id, botIds));

    // 3. Cancel open orders and publish status events for each bot
    for (const bot of liveBots) {
      // Publish bot:status so the socket hub broadcasts the change
      await options.redis
        .publish(
          "bot:status",
          JSON.stringify({ botId: bot.id, status: "stopped", timestamp: Date.now() })
        )
        .catch((err: unknown) => {
          errors.push(
            `redis publish for bot ${bot.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        });

      // Only cancel orders for live-mode bots — fetch the exchange config first
      try {
        const configRows = await options.db
          .select()
          .from(exchangeConfigs)
          .where(eq(exchangeConfigs.exchange, bot.exchange))
          .limit(1);
        const configRow = configRows[0];

        if (!configRow) {
          errors.push(`No exchange config found for bot ${bot.id} (exchange: ${bot.exchange})`);
          continue;
        }

        const openOrders = await options.exchangeManager.fetchOpenOrders(configRow.id, bot.symbol);

        for (const order of openOrders) {
          try {
            await options.exchangeManager.cancelOrder(configRow.id, order.symbol, order.id);
            cancelledOrders++;
          } catch (err) {
            errors.push(
              `cancel order ${order.id} for bot ${bot.id}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      } catch (err) {
        errors.push(
          `fetch open orders for bot ${bot.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return { stoppedBots: liveBots.length, cancelledOrders, errors };
  });

  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: ({ req, res }: { req: FastifyRequest; res: FastifyReply }) =>
        createTrpcContext(
          {
            db: options.db,
            redis: options.redis,
            queues: options.queues,
            exchangeManager: options.exchangeManager,
            keyVault: options.keyVault,
            exportsDir: options.exportsDir,
          },
          req,
          res
        ),
      onError: ({ error, path }: { error: unknown; path?: string }) => {
        app.log.error({ error, path }, "tRPC request failed");
      },
    },
  });

  if (options.enableBullBoard) {
    if (!options.bullBoardAuth) {
      app.log.warn("Bull Board auth is not configured; skipping /admin/queues registration");
    } else {
      const bullBoardAuth = options.bullBoardAuth;
      const serverAdapter = new FastifyAdapter();
      serverAdapter.setBasePath("/admin/queues");
      createBullBoard({
        queues: [
          new BullMQAdapter(options.queues.botExecutionQueue),
          new BullMQAdapter(options.queues.backtestQueue),
          new BullMQAdapter(options.queues.dataCollectionQueue),
          new BullMQAdapter(options.queues.dataBackfillQueue),
          new BullMQAdapter(options.queues.dataExportQueue),
        ],
        serverAdapter,
      });

      await app.register(async (adminApp) => {
        adminApp.addHook("onRequest", async (request, reply) => {
          if (!isAuthorized(request.headers.authorization, bullBoardAuth)) {
            reply
              .code(401)
              .header("www-authenticate", 'Basic realm="Bull Board"')
              .send({ error: "Unauthorized" });
          }
        });

        await adminApp.register(serverAdapter.registerPlugin(), { prefix: "/admin/queues" });
      });
    }
  }

  return app;
}

function isAuthorized(
  authorization: string | undefined,
  credentials: { username: string; password: string }
) {
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  const encoded = authorization.slice("Basic ".length).trim();
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return false;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  return safeCompare(username, credentials.username) && safeCompare(password, credentials.password);
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
