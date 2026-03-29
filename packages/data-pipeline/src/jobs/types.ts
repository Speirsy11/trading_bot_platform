export interface CollectOHLCVJobData {
  exchange: string;
  symbol: string;
  timeframe: string;
}

export interface BackfillJobData {
  exchange: string;
  symbol: string;
  timeframe: string;
  startTime: string; // ISO string
  endTime: string;
}

export interface DetectGapsJobData {
  exchange: string;
  symbol: string;
  timeframe: string;
}

export interface ExportJobData {
  exportId: string;
  exchange: string;
  symbols: string[];
  timeframe: string;
  startTime: string;
  endTime: string;
  format: "csv" | "parquet" | "sqlite";
  compressed: boolean;
  outputDir: string;
}

export const QUEUE_NAMES = {
  DATA_COLLECTION: "data-collection",
  DATA_BACKFILL: "data-backfill",
  DATA_EXPORT: "data-export",
} as const;

export const JOB_NAMES = {
  COLLECT_OHLCV_1M: "collect-ohlcv-1m",
  COLLECT_OHLCV_1H: "collect-ohlcv-1h",
  COLLECT_OHLCV_DAILY: "collect-ohlcv-daily",
  DETECT_GAPS: "detect-gaps",
  BACKFILL: "backfill",
  EXPORT_DATA: "export-data",
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 2000,
  },
  removeOnComplete: { age: 86400 },
  removeOnFail: { age: 604800 },
};
