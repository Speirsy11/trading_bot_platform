# Operations

## Ingestion on the Mac mini

The local Compose ingestion profile runs Postgres, Redis, the bootstrap job, and the worker process. The workers start the live market-data collector by default with `LIVE_MARKET_DATA_ENABLED=1`.

```bash
pnpm docker:ingest:up
pnpm docker:ingest:logs
```

For a safe end-to-end demo/testing mode with fake market data, bots, trades, and backtests, run:

```bash
APP_MODE=testing SEED_TESTING_DATA=1 LIVE_MARKET_DATA_ENABLED=0 pnpm docker:ingest:up
```

Testing mode seeds realistic synthetic BTC/ETH/SOL data and disables live trading. Use it to exercise dashboard, market-data, bot, backtest, export, and status flows without exchange credentials or real orders.

The Compose services use restart policies so Docker can keep them running after restarts. For macOS login/startup, install the launchd plist:

```bash
cp docker/com.charlie.trading-bot-ingest.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.charlie.trading-bot-ingest.plist
```

Unload it with:

```bash
launchctl unload ~/Library/LaunchAgents/com.charlie.trading-bot-ingest.plist
```

## Backups

Run a local compressed Postgres backup with:

```bash
DATABASE_URL="$DATABASE_URL" ./scripts/backup-postgres.sh
```

Useful environment variables:

- `BACKUP_DIR` — destination directory, defaults to `./backups`
- `BACKUP_RETENTION_DAYS` — local retention window, defaults to `14`

For off-machine backups, sync `BACKUP_DIR` to S3/R2/B2 with your preferred backup agent. Do not commit generated dumps.

## Production hardening checklist

- Set non-default `POSTGRES_PASSWORD`, `DATABASE_URL`, `API_AUTH_TOKEN`, and `ENCRYPTION_KEY`.
- Keep exchange API keys read-only unless live trading is deliberately enabled.
- Leave `TRADING_ENABLED=false` until order execution has been tested on paper/sandbox. `APP_MODE=testing` also blocks live order routes.
- Keep `OHLCV_RETENTION_DAYS=0` unless you deliberately want to purge old backtesting candles.
- Use `BOT_MAX_MARKET_DATA_STALENESS_MS` to tune how stale canonical candle data may be before bots refuse to start.
- Monitor worker health at `http://localhost:3002/health` and queue stats through the API.
