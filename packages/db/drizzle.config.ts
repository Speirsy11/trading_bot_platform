import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/*",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env["DATABASE_URL"] ||
      "postgresql://trading_bot:changeme@localhost:5432/trading_bot_dev",
  },
} satisfies Config;
