CREATE TABLE "backtests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"strategy" text NOT NULL,
	"strategy_params" jsonb DEFAULT '{}'::jsonb,
	"exchange" text NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"initial_balance" numeric(20, 8) NOT NULL,
	"final_balance" numeric(20, 8),
	"total_pnl" numeric(20, 8),
	"total_pnl_percent" numeric(10, 4),
	"total_trades" integer,
	"winning_trades" integer,
	"losing_trades" integer,
	"win_rate" numeric(5, 2),
	"max_drawdown" numeric(10, 4),
	"sharpe_ratio" numeric(10, 4),
	"profit_factor" numeric(10, 4),
	"metrics" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"risk_config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "backtest_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backtest_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"cost" numeric(20, 8) NOT NULL,
	"fee" numeric(20, 8),
	"pnl" numeric(20, 8),
	"pnl_percent" numeric(10, 4),
	"balance" numeric(20, 8),
	"reason" text,
	"executed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bot_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"strategy" text NOT NULL,
	"strategy_params" jsonb DEFAULT '{}'::jsonb,
	"exchange" text NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"mode" text DEFAULT 'backtest' NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"risk_config" jsonb DEFAULT '{}'::jsonb,
	"current_balance" numeric(20, 8),
	"total_pnl" numeric(20, 8),
	"total_trades" numeric(20, 8),
	"win_rate" numeric(5, 2),
	"error_message" text,
	"started_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bot_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"order_id" text,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"cost" numeric(20, 8) NOT NULL,
	"fee" numeric(20, 8),
	"fee_currency" text,
	"pnl" numeric(20, 8),
	"pnl_percent" numeric(10, 4),
	"reason" text,
	"executed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_collection_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange" text NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"earliest" timestamp with time zone,
	"latest" timestamp with time zone,
	"total_candles" bigint DEFAULT 0,
	"gap_count" integer DEFAULT 0,
	"status" text DEFAULT 'idle',
	"last_collected_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "data_collection_status_unique" UNIQUE("exchange","symbol","timeframe")
);
--> statement-breakpoint
CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange" text NOT NULL,
	"symbols" text[] NOT NULL,
	"timeframe" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"format" text NOT NULL,
	"compressed" boolean DEFAULT true,
	"file_path" text,
	"file_size" bigint,
	"row_count" bigint,
	"status" text DEFAULT 'pending',
	"progress" real DEFAULT 0,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exchange_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"api_key" text,
	"api_secret" text,
	"passphrase" text,
	"sandbox" boolean DEFAULT false,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "exchange_configs_exchange_unique" UNIQUE("exchange")
);
--> statement-breakpoint
CREATE TABLE "ohlcv" (
	"time" timestamp with time zone NOT NULL,
	"exchange" text NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"open" numeric(20, 8) NOT NULL,
	"high" numeric(20, 8) NOT NULL,
	"low" numeric(20, 8) NOT NULL,
	"close" numeric(20, 8) NOT NULL,
	"volume" numeric(20, 8) NOT NULL,
	"trades_count" bigint,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ohlcv_unique" UNIQUE("exchange","symbol","timeframe","time")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_backtest_id_backtests_id_fk" FOREIGN KEY ("backtest_id") REFERENCES "public"."backtests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_logs" ADD CONSTRAINT "bot_logs_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_trades" ADD CONSTRAINT "bot_trades_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ohlcv_lookup" ON "ohlcv" USING btree ("exchange","symbol","timeframe","time");