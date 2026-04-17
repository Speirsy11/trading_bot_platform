/**
 * Validates and prints a startup env summary table.
 * Throws if any required var is missing.
 */
export interface EnvVar {
  name: string;
  required: boolean;
  defaultValue?: string;
  redacted?: boolean; // true for secrets — show "***" instead of value
}

export const ENV_VARS: EnvVar[] = [
  { name: "DATABASE_URL", required: true, redacted: true },
  { name: "REDIS_URL", required: false, defaultValue: "redis://127.0.0.1:6379" },
  { name: "API_PORT", required: false, defaultValue: "3001" },
  { name: "API_HOST", required: false, defaultValue: "0.0.0.0" },
  { name: "ENCRYPTION_KEY", required: true, redacted: true },
  { name: "API_AUTH_TOKEN", required: true, redacted: true },
  { name: "ALLOWED_ORIGINS", required: false },
  { name: "MAX_NOTIONAL_USD", required: false, defaultValue: "10000" },
  { name: "DAILY_LOSS_LIMIT_USD", required: false },
  { name: "BALANCE_DROP_THRESHOLD_PCT", required: false, defaultValue: "20" },
  { name: "BOT_LOG_RETENTION_DAYS", required: false, defaultValue: "30" },
  { name: "OHLCV_RETENTION_DAYS", required: false, defaultValue: "365" },
  { name: "NODE_ENV", required: false, defaultValue: "development" },
  { name: "BULL_BOARD_USERNAME", required: false },
  { name: "BULL_BOARD_PASSWORD", required: false, redacted: true },
];

type RowStatus = "SET" | "DEFAULT" | "MISSING";

interface EnvRow {
  name: string;
  status: RowStatus;
  displayValue: string;
}

function buildRows(): { rows: EnvRow[]; missingRequired: string[] } {
  const rows: EnvRow[] = [];
  const missingRequired: string[] = [];

  for (const spec of ENV_VARS) {
    const raw = process.env[spec.name];
    const isSet = raw !== undefined && raw !== "";

    let status: RowStatus;
    let displayValue: string;

    if (isSet) {
      status = "SET";
      displayValue = spec.redacted ? "***" : raw;
    } else if (spec.defaultValue !== undefined) {
      status = "DEFAULT";
      displayValue = spec.redacted ? "***" : spec.defaultValue;
    } else {
      status = "MISSING";
      displayValue = spec.required ? "(required)" : "(not set)";
      if (spec.required) {
        missingRequired.push(spec.name);
      }
    }

    rows.push({ name: spec.name, status, displayValue });
  }

  return { rows, missingRequired };
}

function padEnd(str: string, width: number): string {
  return str.length >= width ? str : str + " ".repeat(width - str.length);
}

function buildTable(rows: EnvRow[]): string {
  const COL_NAME = 30;
  const COL_STATUS = 9;
  const COL_VALUE = 30;

  const header =
    padEnd("Variable", COL_NAME) + "| " + padEnd("Status", COL_STATUS) + "| " + "Value";

  const divider =
    "-".repeat(COL_NAME) + "+-" + "-".repeat(COL_STATUS) + "+-" + "-".repeat(COL_VALUE);

  const lines: string[] = [header, divider];

  for (const row of rows) {
    const line =
      padEnd(row.name, COL_NAME) + "| " + padEnd(row.status, COL_STATUS) + "| " + row.displayValue;
    lines.push(line);
  }

  return lines.join("\n");
}

export function validateAndPrintEnv(): void {
  const { rows, missingRequired } = buildRows();
  const table = buildTable(rows);

  console.info("\nEnvironment configuration:\n");
  console.info(table);
  console.info("");

  if (missingRequired.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missingRequired.join(", ")}`);
  }
}
