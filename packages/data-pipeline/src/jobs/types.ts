export interface ExportJobData {
  exportId: string;
  exchange: string;
  symbols: string[];
  timeframe: string;
  startTime: string;
  endTime: string;
  format: "csv" | "parquet" | "sqlite";
  compressed: boolean;
  compressionFormat: "gzip" | "zstd";
  outputDir: string;
}

export const QUEUE_NAMES = {
  DATA_EXPORT: "data-export",
} as const;
