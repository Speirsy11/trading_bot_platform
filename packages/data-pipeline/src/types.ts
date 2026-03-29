import type { Database } from "@tb/db";

export interface PipelineConfig {
  db: Database;
  redisUrl: string;
  exportDir: string;
}

export interface CollectionResult {
  exchange: string;
  symbol: string;
  timeframe: string;
  inserted: number;
  invalid: number;
}
