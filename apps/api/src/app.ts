import { timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import type { Database } from "@tb/db";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { sql } from "drizzle-orm";
import Fastify, {
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import type IORedis from "ioredis";
import { Server } from "socket.io";

import type { QueueSet } from "./queues/index";
import type { ExchangeManager } from "./services/exchangeManager";
import type { KeyVault } from "./services/keyVault";
import { createTrpcContext } from "./trpc/context";
import { appRouter } from "./trpc/router";
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
  const app = Fastify({ logger: options.loggerOptions ?? true });

  await app.register(fastifyCors, {
    origin: true,
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
    max: 300,
    timeWindow: "1 minute",
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
      origin: true,
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
  app.get("/health", async () => {
    const [dbResult, redisResult] = await Promise.allSettled([
      options.db.execute(sql`select 1`),
      options.redis.ping(),
    ]);

    const db = dbResult.status === "fulfilled" ? "connected" : "degraded";
    const redis =
      redisResult.status === "fulfilled" && redisResult.value === "PONG" ? "connected" : "degraded";

    return {
      status: db === "connected" && redis === "connected" ? "ok" : "degraded",
      db,
      redis,
      queues: {
        botExecution: options.queues.botExecutionQueue.name,
        backtest: options.queues.backtestQueue.name,
        dataCollection: options.queues.dataCollectionQueue.name,
        dataBackfill: options.queues.dataBackfillQueue.name,
        dataExport: options.queues.dataExportQueue.name,
      },
      errors: {
        db:
          dbResult.status === "rejected"
            ? dbResult.reason instanceof Error
              ? dbResult.reason.message
              : String(dbResult.reason)
            : null,
        redis:
          redisResult.status === "rejected"
            ? redisResult.reason instanceof Error
              ? redisResult.reason.message
              : String(redisResult.reason)
            : null,
      },
      uptime: process.uptime(),
    };
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
