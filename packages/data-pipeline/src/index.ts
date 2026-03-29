// Validation
export { CandleValidator } from "./validation/CandleValidator.js";
export { Deduplicator } from "./validation/Deduplicator.js";
export { GapDetector, type Gap } from "./validation/GapDetector.js";

// Collection
export { OHLCVCollector } from "./collection/OHLCVCollector.js";
export { DataCollector } from "./collection/DataCollector.js";

// Backfill
export { BackfillJob, type BackfillJobConfig } from "./backfill/BackfillJob.js";
export { BackfillManager } from "./backfill/BackfillManager.js";

// Streaming
export { WebSocketManager } from "./streaming/WebSocketManager.js";
export { StreamProcessor } from "./streaming/StreamProcessor.js";
export { ReconnectHandler } from "./streaming/ReconnectHandler.js";

// Export
export { CSVExporter } from "./export/CSVExporter.js";
export { ParquetExporter } from "./export/ParquetExporter.js";
export { SQLiteExporter } from "./export/SQLiteExporter.js";
export { CompressionHelper } from "./export/CompressionHelper.js";
export { ExportManager, type ExportRequest } from "./export/ExportManager.js";

// Rate Limiting
export { ExchangeRateLimiter } from "./rateLimit/ExchangeRateLimiter.js";
export { RATE_LIMIT_DEFAULTS, type RateLimitOptions } from "./rateLimit/RateLimitConfig.js";

// Jobs
export { QUEUE_NAMES, JOB_NAMES, DEFAULT_JOB_OPTIONS } from "./jobs/types.js";
export type {
  CollectOHLCVJobData,
  BackfillJobData,
  DetectGapsJobData,
  ExportJobData,
} from "./jobs/types.js";
export {
  createQueues,
  setupRepeatableJobs,
  addDetectGapsJob,
  addBackfillJob,
  addExportJob,
} from "./jobs/scheduler.js";
export {
  createCollectionWorker,
  createBackfillWorker,
  createExportWorker,
} from "./jobs/workers.js";

// Types
export type { PipelineConfig, CollectionResult } from "./types.js";
