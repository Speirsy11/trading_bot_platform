import { createDb } from "../client";

import { seedDevelopment } from "./development";

async function run() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL must be set");
  }

  const { db, client } = createDb(url);
  try {
    await seedDevelopment(db);
    process.stdout.write("Seeded default collection config (20 pairs, 6 timeframes, binance)\n");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
