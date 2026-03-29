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

import type { QueueSet } from "./queues/index.js";
import type { ExchangeManager } from "./services/exchangeManager.js";
import type { KeyVault } from "./services/keyVault.js";
import { createTrpcContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import { setupSocketHub } from "./websocket/index.js";

interface CreateAppOptions {
  db: Database;
  redis: IORedis;
  subscriber: IORedis;
  queues: QueueSet;
  exchangeManager: ExchangeManager;
  keyVault: KeyVault;
  exportsDir: string;
  enableBullBoard?: boolean;
  loggerOptions?: FastifyServerOptions["logger"];
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({ logger: options.loggerOptions ?? true });

  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await app.register(fastifyRateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });

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
  });

  app.get("/", async () => ({ message: "Trading Bot API" }));
  app.get("/health", async () => {
    await options.db.execute(sql`select 1`);
    const redis = await options.redis.ping();
    return {
      status: "ok",
      db: "connected",
      redis: redis === "PONG" ? "connected" : "degraded",
      queues: {
        botExecution: options.queues.botExecutionQueue.name,
        backtest: options.queues.backtestQueue.name,
        dataCollection: options.queues.dataCollectionQueue.name,
        dataBackfill: options.queues.dataBackfillQueue.name,
        dataExport: options.queues.dataExportQueue.name,
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
    await app.register(serverAdapter.registerPlugin(), { prefix: "/admin/queues" });
  }

  return app;
}
