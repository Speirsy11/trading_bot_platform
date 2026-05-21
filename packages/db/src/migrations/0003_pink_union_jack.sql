CREATE TABLE "strategy_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"strategy" text NOT NULL,
	"strategy_params" jsonb DEFAULT '{}'::jsonb,
	"risk_config" jsonb DEFAULT '{}'::jsonb,
	"exchange" text DEFAULT 'binance' NOT NULL,
	"symbol" text DEFAULT 'BTC/USDT' NOT NULL,
	"timeframe" text DEFAULT '1h' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone
);
