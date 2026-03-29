-- Custom SQL migration: TimescaleDB hypertable and features
-- This runs AFTER the Drizzle schema migration to set up TimescaleDB-specific features

-- Create the ohlcv hypertable with 7-day chunk intervals
SELECT create_hypertable('ohlcv', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Enable compression on the ohlcv hypertable
ALTER TABLE ohlcv SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'time DESC',
    timescaledb.compress_segmentby = 'exchange,symbol,timeframe'
);

-- Add compression policy: compress chunks older than 30 days
SELECT add_compression_policy('ohlcv', INTERVAL '30 days', if_not_exists => true);
