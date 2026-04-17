import type { Database } from "@tb/db";
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import type IORedis from "ioredis";

import type { QueueSet } from "../queues/index";
import type { ExchangeManager } from "../services/exchangeManager";
import type { KeyVault } from "../services/keyVault";

export interface AppContextOptions {
  db: Database;
  redis: IORedis;
  queues: QueueSet;
  exchangeManager: ExchangeManager;
  keyVault: KeyVault;
  exportsDir: string;
}

export interface TrpcContext extends AppContextOptions {
  req?: FastifyRequest;
  res?: FastifyReply;
  auth?: {
    tenantId: string | null;
  };
  requestId: string;
  logger: FastifyBaseLogger;
}

export function createTrpcContext(
  options: AppContextOptions,
  request?: FastifyRequest,
  reply?: FastifyReply
): TrpcContext {
  return {
    ...options,
    req: request,
    res: reply,
    auth: {
      tenantId:
        typeof request?.headers["x-tenant-id"] === "string" ? request.headers["x-tenant-id"] : null,
    },
    requestId: typeof request?.id === "string" ? request.id : String(request?.id ?? ""),
    logger: request?.log ?? reply?.server?.log ?? (console as unknown as FastifyBaseLogger),
  };
}
