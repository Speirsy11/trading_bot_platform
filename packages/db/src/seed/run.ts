import { createDb } from "../client";

import { seedDevelopment } from "./development";
import { seedTestingMode } from "./testing";

async function run() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL must be set");
  }

  const { db, client } = createDb(url);
  try {
    if (process.env["APP_MODE"] === "testing" || process.env["SEED_TESTING_DATA"] === "1") {
      await seedTestingMode(db);
      process.stdout.write(
        "Seeded testing/demo dataset (fake market data, bots, trades, backtests)\n"
      );
    } else {
      await seedDevelopment(db);
      process.stdout.write("Seeded default collection config (3 pairs, 6 timeframes, binance)\n");
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
