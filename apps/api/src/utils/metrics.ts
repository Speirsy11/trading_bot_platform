/**
 * Lightweight Prometheus-compatible metrics registry.
 *
 * prom-client is not installed, so this module provides a minimal
 * Counter, Gauge, and Histogram implementation that emits valid
 * Prometheus text format (version 0.0.4).
 */

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface LabelSet {
  [label: string]: string;
}

function labelKey(labels: LabelSet): string {
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]}"`)
    .join(",");
}

// ---------------------------------------------------------------------------
// Counter
// ---------------------------------------------------------------------------

export class Counter {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = []
  ) {
    metricsRegistry.register(this);
  }

  inc(labels: LabelSet = {}, value = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  serialize(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [key, value] of this.values) {
        const labelStr = key ? `{${key}}` : "";
        lines.push(`${this.name}${labelStr} ${value}`);
      }
    }
    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Gauge
// ---------------------------------------------------------------------------

export class Gauge {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = []
  ) {
    metricsRegistry.register(this);
  }

  set(labels: LabelSet = {}, value: number): void {
    this.values.set(labelKey(labels), value);
  }

  inc(labels: LabelSet = {}, delta = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + delta);
  }

  dec(labels: LabelSet = {}, delta = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) - delta);
  }

  serialize(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [key, value] of this.values) {
        const labelStr = key ? `{${key}}` : "";
        lines.push(`${this.name}${labelStr} ${value}`);
      }
    }
    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

interface HistogramState {
  sum: number;
  count: number;
  buckets: Map<number, number>; // upper-bound -> cumulative count
}

export class Histogram {
  private states = new Map<string, HistogramState>();
  private readonly buckets: number[];

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
    buckets?: number[]
  ) {
    this.buckets = (buckets ?? DEFAULT_BUCKETS).slice().sort((a, b) => a - b);
    metricsRegistry.register(this);
  }

  observe(labels: LabelSet = {}, value: number): void {
    const key = labelKey(labels);
    let state = this.states.get(key);
    if (!state) {
      state = {
        sum: 0,
        count: 0,
        buckets: new Map(this.buckets.map((b) => [b, 0])),
      };
      this.states.set(key, state);
    }
    state.sum += value;
    state.count += 1;
    for (const [upper] of state.buckets) {
      if (value <= upper) {
        state.buckets.set(upper, (state.buckets.get(upper) ?? 0) + 1);
      }
    }
  }

  serialize(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];

    if (this.states.size === 0) {
      // Emit zero-value buckets so Prometheus knows the metric exists
      for (const b of this.buckets) {
        lines.push(`${this.name}_bucket{le="${b}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
    } else {
      for (const [key, state] of this.states) {
        const labelPrefix = key ? `,${key}` : "";
        // Compute cumulative counts (already cumulative per observe())
        let cumulative = 0;
        for (const [upper, bucketCount] of state.buckets) {
          cumulative += bucketCount;
          lines.push(`${this.name}_bucket{le="${upper}"${labelPrefix}} ${cumulative}`);
        }
        // +Inf bucket == total count
        lines.push(`${this.name}_bucket{le="+Inf"${labelPrefix}} ${state.count}`);
        lines.push(`${this.name}_sum${key ? `{${key}}` : ""} ${state.sum}`);
        lines.push(`${this.name}_count${key ? `{${key}}` : ""} ${state.count}`);
      }
    }

    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

type Serializable = { serialize(): string };

class MetricsRegistry {
  private registered: Serializable[] = [];

  register(metric: Serializable): void {
    this.registered.push(metric);
  }

  metrics(): string {
    return this.registered.map((m) => m.serialize()).join("\n\n") + "\n";
  }
}

export const metricsRegistry = new MetricsRegistry();

// ---------------------------------------------------------------------------
// Application metrics
// (Instances register themselves into metricsRegistry on construction.)
// ---------------------------------------------------------------------------

export const httpRequestDuration = new Histogram(
  "http_request_duration_ms",
  "HTTP request latency in milliseconds",
  ["method", "route", "status_code"],
  [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
);

export const trpcRequestCounter = new Counter(
  "trpc_requests_total",
  "Total number of tRPC requests",
  ["path", "type"]
);

export const trpcErrorCounter = new Counter(
  "trpc_errors_total",
  "Total number of failed tRPC requests",
  ["path", "type"]
);

export const wsConnectionGauge = new Gauge(
  "ws_connections_active",
  "Number of active WebSocket connections"
);

export const jobEnqueuedCounter = new Counter(
  "job_enqueued_total",
  "Total number of jobs enqueued",
  ["queue"]
);

export const jobCompletedCounter = new Counter(
  "job_completed_total",
  "Total number of jobs completed successfully",
  ["queue"]
);

export const jobFailedCounter = new Counter("job_failed_total", "Total number of failed jobs", [
  "queue",
]);

export const orderPlacedCounter = new Counter(
  "order_placed_total",
  "Total number of orders placed",
  ["exchange", "side", "type"]
);

export const botTickDuration = new Histogram(
  "bot_tick_duration_ms",
  "Bot strategy tick execution duration in milliseconds",
  ["bot_id"],
  [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500]
);

export const ohlcvCandlesCollected = new Counter(
  "ohlcv_candles_collected_total",
  "Total number of OHLCV candles collected",
  ["exchange", "symbol", "timeframe"]
);

export const ohlcvCollectionErrors = new Counter(
  "ohlcv_collection_errors_total",
  "Total number of OHLCV collection errors",
  ["exchange", "symbol", "timeframe"]
);

export const ohlcvCollectionDuration = new Histogram(
  "ohlcv_collection_duration_ms",
  "OHLCV collection duration in milliseconds",
  ["exchange"],
  [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
);

export const gapsDetectedGauge = new Gauge(
  "ohlcv_gaps_detected",
  "Number of gaps detected in OHLCV data",
  ["exchange", "symbol", "timeframe"]
);
