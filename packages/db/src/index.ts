// Client
export { createDb, type Database } from "./client";

// Schemas
export { ohlcv, type OHLCVRow, type OHLCVInsert } from "./schema/ohlcv";
export { marketTrades, type MarketTradeRow, type MarketTradeInsert } from "./schema/marketTrades";
export {
  marketTickers,
  type MarketTickerRow,
  type MarketTickerInsert,
} from "./schema/marketTickers";
export {
  orderBookSnapshots,
  type OrderBookSnapshotRow,
  type OrderBookSnapshotInsert,
} from "./schema/orderBookSnapshots";
export {
  ingestionEvents,
  type IngestionEventRow,
  type IngestionEventInsert,
} from "./schema/ingestionEvents";
export {
  ingestionHealth,
  type IngestionHealthRow,
  type IngestionHealthInsert,
} from "./schema/ingestionHealth";
export {
  dataCollectionStatus,
  type DataCollectionStatusRow,
  type DataCollectionStatusInsert,
} from "./schema/dataCollection";
export { dataExports, type DataExportRow, type DataExportInsert } from "./schema/dataExports";
export {
  exchangeConfigs,
  type ExchangeConfigRow,
  type ExchangeConfigInsert,
} from "./schema/exchangeConfigs";
export { bots, type BotRow, type BotInsert } from "./schema/bots";
export { botTrades, type BotTradeRow, type BotTradeInsert } from "./schema/botTrades";
export { botLogs, type BotLogRow, type BotLogInsert } from "./schema/botLogs";
export { backtests, type BacktestRow, type BacktestInsert } from "./schema/backtests";
export {
  backtestTrades,
  type BacktestTradeRow,
  type BacktestTradeInsert,
} from "./schema/backtestTrades";
export { settings, type SettingRow, type SettingInsert } from "./schema/settings";
export {
  orderAuditLog,
  type OrderAuditLogRow,
  type OrderAuditLogInsert,
} from "./schema/orderAuditLog";
export { webhooks, type WebhookRow, type WebhookInsert } from "./schema/webhooks";

// Queries
export {
  insertOHLCV,
  upsertOHLCV,
  queryOHLCVByRange,
  queryOHLCVCursor,
  getLatestTimestamp,
  getEarliestTimestamp,
  countCandles,
  type OHLCVCursorParams,
  type OHLCVCursorResult,
} from "./queries/ohlcv";
export {
  upsertMarketTrades,
  insertMarketTickers,
  insertOrderBookSnapshots,
  logIngestionEvent,
  updateIngestionHealth,
  buildCandlesFromTrades,
  deriveCandlesFromLowerTimeframe,
  countExpectedCandles,
  timeframeToMs as marketDataTimeframeToMs,
} from "./queries/marketData";

// Seed
export {
  seedDevelopment,
  DEFAULT_PAIRS,
  DEFAULT_TIMEFRAMES,
  DEFAULT_EXCHANGES,
} from "./seed/development";
export { seedTestingMode } from "./seed/testing";
