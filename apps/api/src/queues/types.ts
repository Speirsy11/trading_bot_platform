import { QUEUE_NAMES as DATA_PIPELINE_QUEUE_NAMES } from "@tb/data-pipeline";

export const API_QUEUE_NAMES = {
  BOT_EXECUTION: "bot-execution",
  BACKTEST: "backtest",
  DATA_COLLECTION: DATA_PIPELINE_QUEUE_NAMES.DATA_COLLECTION,
  DATA_BACKFILL: DATA_PIPELINE_QUEUE_NAMES.DATA_BACKFILL,
  DATA_EXPORT: DATA_PIPELINE_QUEUE_NAMES.DATA_EXPORT,
} as const;

export const BOT_JOB_NAMES = {
  START: "start-bot",
  PAUSE: "pause-bot",
  STOP: "stop-bot",
} as const;

export const BACKTEST_JOB_NAMES = {
  RUN: "run-backtest",
} as const;

export interface BotJobData {
  botId: string;
}

export interface BacktestJobData {
  backtestId: string;
}
