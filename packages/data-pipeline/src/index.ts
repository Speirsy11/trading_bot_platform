// Validation
export { CandleValidator } from "./validation/CandleValidator";
export { Deduplicator } from "./validation/Deduplicator";
export { GapDetector, type Gap } from "./validation/GapDetector";

// Collection
export { OHLCVCollector } from "./collection/OHLCVCollector";
export { DataCollector } from "./collection/DataCollector";

// Backfill
export { BackfillJob, type BackfillJobConfig } from "./backfill/BackfillJob";
export { BackfillManager } from "./backfill/BackfillManager";
export { scheduleBackfill, backfillChunkPriority } from "./backfill/backfillScheduler";

// Streaming
export { WebSocketManager } from "./streaming/WebSocketManager";
export { StreamProcessor } from "./streaming/StreamProcessor";
export { ReconnectHandler } from "./streaming/ReconnectHandler";

// Export
export { CSVExporter } from "./export/CSVExporter";
export { ParquetExporter } from "./export/ParquetExporter";
export { SQLiteExporter } from "./export/SQLiteExporter";
export { CompressionHelper } from "./export/CompressionHelper";
export { ExportManager, type ExportRequest } from "./export/ExportManager";

// Rate Limiting
export { ExchangeRateLimiter } from "./rateLimit/ExchangeRateLimiter";
export { RATE_LIMIT_DEFAULTS, type RateLimitOptions } from "./rateLimit/RateLimitConfig";
export { AdaptiveRateLimiter } from "./rateLimiter";

// Gap Detection
export { detectGaps, detectAllGaps, type OhlcvGap } from "./gapDetector";
export {
  createGapDetectorWorker,
  GAP_DETECTION_QUEUE,
  GAP_DETECTION_REPEAT_PATTERN,
} from "./gapDetectorWorker";

// Jobs
export { QUEUE_NAMES, JOB_NAMES, DEFAULT_JOB_OPTIONS } from "./jobs/types";
export type {
  CollectOHLCVJobData,
  BackfillJobData,
  DetectGapsJobData,
  ExportJobData,
} from "./jobs/types";
export {
  createQueues,
  setupRepeatableJobs,
  setupGapDetectionJob,
  addDetectGapsJob,
  addBackfillJob,
  addExportJob,
} from "./jobs/scheduler";
export { createCollectionWorker, createBackfillWorker, createExportWorker } from "./jobs/workers";

// Metadata
export { CoinGeckoClient, SYMBOL_TO_COINGECKO_ID } from "./metadata/CoinGeckoClient";
export type { CoinMarketData } from "./metadata/CoinGeckoClient";
export {
  createCoinMetadataWorker,
  COIN_METADATA_QUEUE,
  COIN_METADATA_REPEAT_PATTERN,
  COIN_METADATA_CHANNEL,
} from "./metadata/coinMetadataWorker";

// Types
export type { PipelineConfig, CollectionResult } from "./types";
