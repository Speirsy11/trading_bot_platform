import { botLogs, ohlcv, type Database } from "@tb/db";
import { lt } from "drizzle-orm";

/**
 * Purge bot_logs older than retentionDays (default: 30).
 * Purge ohlcv rows older than ohlcvRetentionDays (default: 365).
 * Returns counts of deleted rows.
 */
export async function runDataRetention(
  db: Database,
  options?: { botLogRetentionDays?: number; ohlcvRetentionDays?: number }
): Promise<{ botLogsDeleted: number; ohlcvDeleted: number }> {
  const botLogDays =
    options?.botLogRetentionDays ?? Number(process.env["BOT_LOG_RETENTION_DAYS"] ?? "30");
  const ohlcvDays =
    options?.ohlcvRetentionDays ?? Number(process.env["OHLCV_RETENTION_DAYS"] ?? "365");

  const botLogCutoff = new Date(Date.now() - botLogDays * 86_400_000);
  const ohlcvCutoff = new Date(Date.now() - ohlcvDays * 86_400_000);

  const botLogResult = await db
    .delete(botLogs)
    .where(lt(botLogs.createdAt, botLogCutoff))
    .returning({ id: botLogs.id });

  const ohlcvResult = await db
    .delete(ohlcv)
    .where(lt(ohlcv.time, ohlcvCutoff))
    .returning({ time: ohlcv.time });

  return {
    botLogsDeleted: botLogResult.length,
    ohlcvDeleted: ohlcvResult.length,
  };
}
