// Client
export { createDb, type Database } from "./client.js";

// Schemas
export { ohlcv, type OHLCVRow, type OHLCVInsert } from "./schema/ohlcv.js";
export {
  dataCollectionStatus,
  type DataCollectionStatusRow,
  type DataCollectionStatusInsert,
} from "./schema/dataCollection.js";
export {
  dataExports,
  type DataExportRow,
  type DataExportInsert,
} from "./schema/dataExports.js";
export {
  exchangeConfigs,
  type ExchangeConfigRow,
  type ExchangeConfigInsert,
} from "./schema/exchangeConfigs.js";
export { bots, type BotRow, type BotInsert } from "./schema/bots.js";
export { botTrades, type BotTradeRow, type BotTradeInsert } from "./schema/botTrades.js";
export { botLogs, type BotLogRow, type BotLogInsert } from "./schema/botLogs.js";
export {
  backtests,
  type BacktestRow,
  type BacktestInsert,
} from "./schema/backtests.js";
export {
  backtestTrades,
  type BacktestTradeRow,
  type BacktestTradeInsert,
} from "./schema/backtestTrades.js";
export { settings, type SettingRow, type SettingInsert } from "./schema/settings.js";

// Queries
export {
  insertOHLCV,
  upsertOHLCV,
  queryOHLCVByRange,
  getLatestTimestamp,
  countCandles,
} from "./queries/ohlcv.js";
