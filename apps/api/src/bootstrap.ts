import { resolve } from "node:path";

import { createDb, seedDevelopment, settings } from "@tb/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function bootstrap() {
  const databaseUrl = process.env["DATABASE_URL"]?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before bootstrap");
  }

  const migrationsFolder = resolve(process.cwd(), "../../packages/db/src/migrations");
  const { db, client } = createDb(databaseUrl);

  try {
    process.stdout.write(`Running migrations from ${migrationsFolder}\n`);
    await migrate(db, { migrationsFolder });

    const existingCollectionConfig = await db
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, "collection.pairs"))
      .limit(1);

    if (existingCollectionConfig.length === 0) {
      process.stdout.write("No collection config found. Seeding development defaults.\n");
      await seedDevelopment(db);
    } else {
      process.stdout.write("Collection config already present. Skipping seed.\n");
    }

    process.stdout.write("Database bootstrap complete.\n");
  } finally {
    await client.end();
  }
}

bootstrap().catch((error) => {
  console.error("Database bootstrap failed", error);
  process.exit(1);
});
