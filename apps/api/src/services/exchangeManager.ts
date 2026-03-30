import { exchangeConfigs, type Database, type ExchangeConfigRow } from "@tb/db";
import ccxt, { type Exchange } from "ccxt";
import { eq } from "drizzle-orm";

import { AppError, AppErrorCode, mapExchangeError } from "../utils/errors.js";
import { parseJsonValue } from "../utils/serialization.js";

import type { KeyVault } from "./keyVault.js";

interface ExchangeManagerOptions {
  db: Database;
  keyVault: KeyVault;
}

type CcxtInstance = Exchange;

export function createExchangeManager(options: ExchangeManagerOptions) {
  return new ExchangeManager(options.db, options.keyVault);
}

export class ExchangeManager {
  private readonly cache = new Map<string, CcxtInstance>();
  private readonly publicCache = new Map<string, CcxtInstance>();

  constructor(
    private readonly db: Database,
    private readonly keyVault: KeyVault
  ) {}

  async getExchangeById(exchangeConfigId: string): Promise<CcxtInstance> {
    const config = await this.db
      .select()
      .from(exchangeConfigs)
      .where(eq(exchangeConfigs.id, exchangeConfigId))
      .limit(1);
    const row = config[0];

    if (!row) {
      throw new AppError(AppErrorCode.EXCHANGE_CONNECTION_FAILED, "Exchange config not found", 404);
    }

    return this.getConfiguredExchange(row);
  }

  async getConfiguredExchange(row: ExchangeConfigRow): Promise<CcxtInstance> {
    const cached = this.cache.get(row.id);
    if (cached) {
      return cached;
    }

    try {
      const instance = this.createExchangeInstance({
        exchange: row.exchange,
        apiKey: this.keyVault.decrypt(row.apiKey),
        secret: this.keyVault.decrypt(row.apiSecret),
        password: this.keyVault.decrypt(row.passphrase),
        sandbox: row.sandbox ?? false,
        metadata: parseJsonValue<Record<string, unknown>>(row.metadata, {}),
      });
      this.cache.set(row.id, instance);
      return instance;
    } catch (error) {
      throw mapExchangeError(error);
    }
  }

  async getPublicExchange(exchangeId: string): Promise<CcxtInstance> {
    const cached = this.publicCache.get(exchangeId);
    if (cached) {
      return cached;
    }

    try {
      const instance = this.createExchangeInstance({ exchange: exchangeId, metadata: {} });
      this.publicCache.set(exchangeId, instance);
      return instance;
    } catch (error) {
      throw mapExchangeError(error);
    }
  }

  async testConnection(exchangeConfigId: string) {
    const instance = await this.getExchangeById(exchangeConfigId);

    try {
      await instance.loadMarkets();
      const balance = await instance.fetchBalance();
      return {
        success: true,
        permissions: null,
        balance: {
          totalAssets: Object.keys(balance.total ?? {}).length,
          currencies: Object.keys(balance.free ?? {}).slice(0, 10),
        },
      };
    } catch (error) {
      throw mapExchangeError(error);
    }
  }

  async fetchTicker(exchangeId: string, symbol: string) {
    try {
      const instance = await this.getPublicExchange(exchangeId);
      const ticker = await instance.fetchTicker(symbol);
      return {
        exchange: exchangeId,
        symbol,
        bid: ticker.bid ?? 0,
        ask: ticker.ask ?? 0,
        last: ticker.last ?? 0,
        volume: ticker.baseVolume ?? 0,
        change24h: ticker.percentage ?? 0,
        timestamp: ticker.timestamp ?? Date.now(),
      };
    } catch (error) {
      throw mapExchangeError(error);
    }
  }

  async getAvailableSymbols(exchangeId: string): Promise<string[]> {
    try {
      const instance = await this.getPublicExchange(exchangeId);
      const markets = await instance.loadMarkets();
      return Object.keys(markets).sort();
    } catch (error) {
      throw mapExchangeError(error);
    }
  }

  clearCache(exchangeConfigId?: string) {
    if (exchangeConfigId) {
      this.cache.delete(exchangeConfigId);
      this.publicCache.clear();
      return;
    }

    this.cache.clear();
    this.publicCache.clear();
  }

  private createExchangeInstance(config: {
    exchange: string;
    apiKey?: string | null;
    secret?: string | null;
    password?: string | null;
    sandbox?: boolean;
    metadata: Record<string, unknown>;
  }): CcxtInstance {
    const registry = ccxt as unknown as Record<
      string,
      new (opts: Record<string, unknown>) => CcxtInstance
    >;
    const ExchangeCtor = registry[config.exchange];

    if (!ExchangeCtor) {
      throw new AppError(
        AppErrorCode.EXCHANGE_CONNECTION_FAILED,
        `Unsupported exchange: ${config.exchange}`,
        400
      );
    }

    const metadata = filterReservedExchangeOptions(config.metadata);
    const instance = new ExchangeCtor({
      ...metadata,
      enableRateLimit: true,
      apiKey: config.apiKey ?? undefined,
      secret: config.secret ?? undefined,
      password: config.password ?? undefined,
    });

    if (config.sandbox && typeof instance.setSandboxMode === "function") {
      instance.setSandboxMode(true);
    }

    return instance;
  }
}

function filterReservedExchangeOptions(metadata: Record<string, unknown>) {
  const reserved = new Set(["enableRateLimit", "apiKey", "secret", "password"]);
  return Object.fromEntries(Object.entries(metadata ?? {}).filter(([key]) => !reserved.has(key)));
}
