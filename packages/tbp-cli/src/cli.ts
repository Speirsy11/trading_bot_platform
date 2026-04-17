#!/usr/bin/env tsx
import { createClient } from "@tb/sdk";
import { Command } from "commander";

import type { AppRouter } from "../../../apps/api/src/trpc/router";

// ── ANSI colours (no external dep) ─────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  grey: "\x1b[90m",
};

function col(code: string, text: string) {
  return `${code}${text}${c.reset}`;
}

// ── Config from environment ─────────────────────────────────────────────────
const API_URL = process.env.TBP_API_URL ?? "http://localhost:3001";
const AUTH_TOKEN = process.env.TBP_AUTH_TOKEN;

// ── tRPC client ─────────────────────────────────────────────────────────────
function getClient() {
  return createClient<AppRouter>(API_URL, AUTH_TOKEN);
}

// ── Output helpers ──────────────────────────────────────────────────────────
function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function printError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(col(c.red, `Error: ${msg}`));
  process.exit(1);
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    running: c.green,
    starting: c.cyan,
    paused: c.yellow,
    stopped: c.grey,
    idle: c.grey,
    error: c.red,
  };
  return col(map[status] ?? c.reset, status);
}

// ── Programme ───────────────────────────────────────────────────────────────
const program = new Command();

program
  .name("tbp")
  .description("Trading Bot Platform CLI")
  .version("0.0.0")
  .option("--json", "output machine-readable JSON")
  .addHelpText(
    "after",
    `
Environment:
  TBP_API_URL     API base URL (default: http://localhost:3001)
  TBP_AUTH_TOKEN  Bearer token for protected procedures`
  );

// ── tbp health ──────────────────────────────────────────────────────────────
program
  .command("health")
  .description("check API health")
  .action(async () => {
    const json = program.opts().json as boolean;
    try {
      const res = await fetch(`${API_URL}/health`);
      const body = (await res.json().catch(() => ({ status: res.statusText }))) as Record<
        string,
        unknown
      >;
      if (json) {
        printJson({ ok: res.ok, status: res.status, body });
      } else {
        if (res.ok) {
          console.log(col(c.green, `✓ API is healthy`) + col(c.grey, ` (${API_URL})`));
        } else {
          console.log(col(c.red, `✗ API returned ${res.status}`) + col(c.grey, ` (${API_URL})`));
          process.exit(1);
        }
      }
    } catch (err) {
      if (json) {
        printJson({ ok: false, error: err instanceof Error ? err.message : String(err) });
        process.exit(1);
      }
      printError(err);
    }
  });

// ── tbp bots ────────────────────────────────────────────────────────────────
const bots = program.command("bots").description("manage trading bots");

bots
  .command("list")
  .description("list all bots with status")
  .option("--status <status>", "filter by status (running|paused|stopped|idle|error|all)")
  .option("--exchange <exchange>", "filter by exchange")
  .action(async (opts: { status?: string; exchange?: string }) => {
    const json = program.opts().json as boolean;
    try {
      const client = getClient();
      const rows = await client.bots.list.query({
        status: opts.status as
          | "all"
          | "running"
          | "paused"
          | "stopped"
          | "starting"
          | "idle"
          | "error"
          | undefined,
        exchange: opts.exchange,
      });

      if (json) {
        printJson(rows);
        return;
      }

      if (rows.length === 0) {
        console.log(col(c.grey, "No bots found."));
        return;
      }

      const colWidths = { id: 36, name: 24, strategy: 16, exchange: 12, symbol: 12, tf: 6 };

      const header = [
        col(c.bold, "ID".padEnd(colWidths.id)),
        col(c.bold, "Name".padEnd(colWidths.name)),
        col(c.bold, "Strategy".padEnd(colWidths.strategy)),
        col(c.bold, "Exchange".padEnd(colWidths.exchange)),
        col(c.bold, "Symbol".padEnd(colWidths.symbol)),
        col(c.bold, "TF".padEnd(colWidths.tf)),
        col(c.bold, "Status"),
      ].join("  ");

      console.log(header);
      console.log(col(c.grey, "─".repeat(120)));

      for (const bot of rows) {
        const line = [
          col(c.grey, bot.id.padEnd(colWidths.id)),
          (bot.name ?? "").padEnd(colWidths.name).slice(0, colWidths.name),
          (bot.strategy ?? "").padEnd(colWidths.strategy).slice(0, colWidths.strategy),
          (bot.exchange ?? "").padEnd(colWidths.exchange).slice(0, colWidths.exchange),
          (bot.symbol ?? "").padEnd(colWidths.symbol).slice(0, colWidths.symbol),
          (bot.timeframe ?? "").padEnd(colWidths.tf).slice(0, colWidths.tf),
          statusColor(bot.status ?? "idle"),
        ].join("  ");
        console.log(line);
      }

      console.log(col(c.grey, `\n${rows.length} bot(s) total.`));
    } catch (err) {
      if (program.opts().json) {
        printJson({ error: err instanceof Error ? err.message : String(err) });
        process.exit(1);
      }
      printError(err);
    }
  });

bots
  .command("start <botId>")
  .description("start a bot")
  .action(async (botId: string) => {
    const json = program.opts().json as boolean;
    requireAuth();
    try {
      const client = getClient();
      const result = await client.bots.start.mutate({ botId });
      if (json) {
        printJson(result);
        return;
      }
      console.log(
        col(c.green, `✓ Bot ${botId} is starting`) +
          (result.jobId ? col(c.grey, ` (job ${result.jobId})`) : "")
      );
    } catch (err) {
      if (json) {
        printJson({ error: err instanceof Error ? err.message : String(err) });
        process.exit(1);
      }
      printError(err);
    }
  });

bots
  .command("stop <botId>")
  .description("stop a bot")
  .action(async (botId: string) => {
    const json = program.opts().json as boolean;
    requireAuth();
    try {
      const client = getClient();
      await client.bots.stop.mutate({ botId });
      if (json) {
        printJson({ success: true });
        return;
      }
      console.log(col(c.yellow, `✓ Bot ${botId} stopped.`));
    } catch (err) {
      if (json) {
        printJson({ error: err instanceof Error ? err.message : String(err) });
        process.exit(1);
      }
      printError(err);
    }
  });

// ── tbp backfill ────────────────────────────────────────────────────────────
program
  .command("backfill <exchange> <symbol> <tf>")
  .description("schedule a historical OHLCV backfill job")
  .option("--from <date>", "start date (ISO-8601 or YYYY-MM-DD)", "2020-01-01")
  .option("--to <date>", "end date  (ISO-8601 or YYYY-MM-DD)", () => new Date().toISOString())
  .action(
    async (exchange: string, symbol: string, tf: string, opts: { from: string; to: string }) => {
      const json = program.opts().json as boolean;
      try {
        const startTime = toIso(opts.from);
        const endTime = toIso(opts.to);
        const client = getClient();
        const result = await client.dataCollection.backfill.mutate({
          exchange,
          symbol,
          timeframe: tf,
          startTime,
          endTime,
        });
        if (json) {
          printJson({ queued: result.queued, exchange, symbol, timeframe: tf, startTime, endTime });
          return;
        }
        console.log(
          col(c.green, "✓ Backfill queued") +
            col(c.grey, ` — ${exchange} ${symbol} ${tf}  ${opts.from} → ${opts.to}`)
        );
      } catch (err) {
        if (program.opts().json) {
          printJson({ error: err instanceof Error ? err.message : String(err) });
          process.exit(1);
        }
        printError(err);
      }
    }
  );

// ── tbp export ──────────────────────────────────────────────────────────────
program
  .command("export <exchange> <symbol> <tf>")
  .description("trigger a data export job")
  .option("--format <fmt>", "output format: csv | parquet | sqlite", "csv")
  .option("--from <date>", "start date (ISO-8601 or YYYY-MM-DD)", "2020-01-01")
  .option("--to <date>", "end date  (ISO-8601 or YYYY-MM-DD)", () => new Date().toISOString())
  .option("--no-compress", "skip gzip compression")
  .action(
    async (
      exchange: string,
      symbol: string,
      tf: string,
      opts: { format: string; from: string; to: string; compress: boolean }
    ) => {
      const json = program.opts().json as boolean;
      const format = opts.format as "csv" | "parquet" | "sqlite";
      if (!["csv", "parquet", "sqlite"].includes(format)) {
        console.error(col(c.red, `Invalid format "${format}". Choose csv, parquet, or sqlite.`));
        process.exit(1);
      }
      try {
        const startTime = Date.parse(opts.from);
        const endTime = Date.parse(opts.to);
        if (isNaN(startTime) || isNaN(endTime)) {
          throw new Error("Invalid --from or --to date. Use ISO-8601 or YYYY-MM-DD.");
        }
        const client = getClient();
        const result = await client.dataExport.create.mutate({
          exchange,
          symbols: [symbol],
          timeframe: tf,
          startTime,
          endTime,
          format,
          compress: opts.compress,
        });
        if (json) {
          printJson(result);
          return;
        }
        console.log(
          col(c.green, "✓ Export queued") +
            col(c.grey, ` — ${exchange} ${symbol} ${tf}  ${opts.from} → ${opts.to}`) +
            `\n  Export ID: ${col(c.cyan, result.exportId)}`
        );
        console.log(col(c.grey, `  Poll status: tbp export-status ${result.exportId}`));
      } catch (err) {
        if (json) {
          printJson({ error: err instanceof Error ? err.message : String(err) });
          process.exit(1);
        }
        printError(err);
      }
    }
  );

// ── tbp export-status ───────────────────────────────────────────────────────
program
  .command("export-status <exportId>")
  .description("check the status of a queued export")
  .action(async (exportId: string) => {
    const json = program.opts().json as boolean;
    try {
      const client = getClient();
      const status = await client.dataExport.getStatus.query({ exportId });
      if (json) {
        printJson(status);
        return;
      }
      const statusLabel = status.status ?? "unknown";
      const statusStr =
        statusLabel === "completed"
          ? col(c.green, statusLabel)
          : statusLabel === "failed"
            ? col(c.red, statusLabel)
            : col(c.yellow, statusLabel);
      console.log(`Status:   ${statusStr}`);
      console.log(`Progress: ${status.progress}%`);
      if (status.downloadUrl) {
        console.log(`Download: ${col(c.cyan, `${API_URL}${status.downloadUrl}`)}`);
      }
      if (status.error) {
        console.log(`Error:    ${col(c.red, status.error)}`);
      }
    } catch (err) {
      if (json) {
        printJson({ error: err instanceof Error ? err.message : String(err) });
        process.exit(1);
      }
      printError(err);
    }
  });

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a loose date string to a full ISO-8601 datetime string expected by the API. */
function toIso(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.error(col(c.red, `Invalid date: "${date}". Use ISO-8601 or YYYY-MM-DD.`));
    process.exit(1);
  }
  return d.toISOString();
}

/** Warn and exit if TBP_AUTH_TOKEN is not set (needed for protected procedures). */
function requireAuth() {
  if (!AUTH_TOKEN) {
    console.error(
      col(c.red, "TBP_AUTH_TOKEN is not set.") +
        " Protected procedures require a bearer token.\n" +
        col(c.grey, "  export TBP_AUTH_TOKEN=<your-token>")
    );
    process.exit(1);
  }
}

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(col(c.red, err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
