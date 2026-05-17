ALTER TABLE "ohlcv" ADD COLUMN "source" text DEFAULT 'collector' NOT NULL;--> statement-breakpoint
ALTER TABLE "ohlcv" ADD COLUMN "provisional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ohlcv" ADD COLUMN "closed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ohlcv" ADD COLUMN "repaired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ohlcv" ADD COLUMN "exchange_verified" boolean DEFAULT false NOT NULL;