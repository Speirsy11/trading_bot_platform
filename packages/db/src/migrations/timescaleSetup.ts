import { sql } from "drizzle-orm";

import type { Database } from "../client";

export async function runTimescaleSetup(db: Database) {
  // Create ohlcv hypertable
  await db.execute(sql`
    SELECT create_hypertable('ohlcv', 'time',
      chunk_time_interval => INTERVAL '7 days',
      if_not_exists => TRUE
    )
  `);

  // Enable compression
  await db.execute(sql`
    ALTER TABLE ohlcv SET (
      timescaledb.compress,
      timescaledb.compress_orderby = 'time DESC',
      timescaledb.compress_segmentby = 'exchange,symbol,timeframe'
    )
  `);

  // Add compression policy
  await db.execute(sql`
    SELECT add_compression_policy('ohlcv', INTERVAL '30 days', if_not_exists => true)
  `);
}
