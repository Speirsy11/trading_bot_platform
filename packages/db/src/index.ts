// Client
export { createDb, type Database } from "./client";

// Schemas
export { ohlcv, type OHLCVRow, type OHLCVInsert } from "./schema/ohlcv";
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

// Queries
export {
  insertOHLCV,
  upsertOHLCV,
  queryOHLCVByRange,
  queryOHLCVCursor,
  getLatestTimestamp,
  countCandles,
  type OHLCVCursorParams,
  type OHLCVCursorResult,
} from "./queries/ohlcv";

// Seed
export { seedDevelopment } from "./seed/development";
