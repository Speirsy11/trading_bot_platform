CREATE TABLE "research_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sweep_id" uuid NOT NULL,
	"strategy" text NOT NULL,
	"strategy_name" text NOT NULL,
	"strategy_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"param_hash" text NOT NULL,
	"timeframe" text NOT NULL,
	"market_mode" text DEFAULT 'spot' NOT NULL,
	"symbols" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"train_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"test_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"per_symbol_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"portfolio_equity_curve" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"drawdown_curve" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_coverage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qualified" boolean DEFAULT false NOT NULL,
	"qualification_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"out_of_sample_return" numeric(12, 4),
	"max_drawdown" numeric(12, 4),
	"sharpe_ratio" numeric(12, 4),
	"profit_factor" numeric(12, 4),
	"win_rate" numeric(12, 4),
	"total_trades" numeric(20, 8),
	"positive_symbols" numeric(20, 8),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "research_sweeps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"symbols" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeframes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strategy_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"best_result_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "research_results" ADD CONSTRAINT "research_results_sweep_id_research_sweeps_id_fk" FOREIGN KEY ("sweep_id") REFERENCES "public"."research_sweeps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_research_results_sweep" ON "research_results" USING btree ("sweep_id");--> statement-breakpoint
CREATE INDEX "idx_research_results_leaderboard" ON "research_results" USING btree ("qualified","out_of_sample_return","max_drawdown");