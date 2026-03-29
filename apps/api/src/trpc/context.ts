import type { Database } from "@tb/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import type IORedis from "ioredis";

import type { QueueSet } from "../queues/index.js";
import type { ExchangeManager } from "../services/exchangeManager.js";
import type { KeyVault } from "../services/keyVault.js";

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
  };
}
