CREATE TABLE "ingestion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange" text,
	"symbol" text,
	"timeframe" text,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ingestion_health" (
	"id" text PRIMARY KEY NOT NULL,
	"exchange" text NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"latest_candle_at" timestamp with time zone,
	"latest_event_at" timestamp with time zone,
	"websocket_status" text DEFAULT 'unknown' NOT NULL,
	"disconnected_since" timestamp with time zone,
	"rest_fallback_count" integer DEFAULT 0 NOT NULL,
	"validation_failures" integer DEFAULT 0 NOT NULL,
	"api_errors" integer DEFAULT 0 NOT NULL,
	"repair_failures" integer DEFAULT 0 NOT NULL,
	"backfill_backlog" integer DEFAULT 0 NOT NULL,
	"candles_inserted" bigint DEFAULT 0 NOT NULL,
	"missing_candles" integer DEFAULT 0 NOT NULL,
	"completeness_bps" integer DEFAULT 10000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ingestion_health_unique" UNIQUE("exchange","symbol","timeframe")
);
--> statement-breakpoint
CREATE TABLE "market_tickers" (
	"id" text PRIMARY KEY NOT NULL,
	"exchange" text NOT NULL,
	"symbol" text NOT NULL,
	"bid" numeric(20, 8),
	"ask" numeric(20, 8),
	"last" numeric(20, 8) NOT NULL,
	"volume" numeric(20, 8),
	"change_24h" numeric(10, 4),
	"ticker_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now(),
	"source" text DEFAULT 'websocket' NOT NULL,
	"raw" text
);
--> statement-breakpoint
CREATE TABLE "market_trades" (
	"id" text PRIMARY KEY NOT NULL,
	"exchange" text NOT NULL,
	"symbol" text NOT NULL,
	"trade_id" text,
	"side" text,
	"price" numeric(20, 8) NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"cost" numeric(20, 8),
	"traded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now(),
	"source" text DEFAULT 'websocket' NOT NULL,
	"raw" text,
	CONSTRAINT "market_trades_exchange_trade_unique" UNIQUE("exchange","symbol","trade_id")
);
--> statement-breakpoint
CREATE TABLE "orderbook_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"exchange" text NOT NULL,
	"symbol" text NOT NULL,
	"bids" jsonb NOT NULL,
	"asks" jsonb NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now(),
	"source" text DEFAULT 'websocket' NOT NULL,
	"raw" text
);
--> statement-breakpoint
CREATE INDEX "idx_ingestion_events_lookup" ON "ingestion_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_ingestion_health_lookup" ON "ingestion_health" USING btree ("exchange","symbol","timeframe");--> statement-breakpoint
CREATE INDEX "idx_market_tickers_lookup" ON "market_tickers" USING btree ("exchange","symbol","ticker_at");--> statement-breakpoint
CREATE INDEX "idx_market_trades_lookup" ON "market_trades" USING btree ("exchange","symbol","traded_at");--> statement-breakpoint
CREATE INDEX "idx_orderbook_snapshots_lookup" ON "orderbook_snapshots" USING btree ("exchange","symbol","snapshot_at");