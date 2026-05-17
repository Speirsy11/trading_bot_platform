import Fastify from "fastify";
import postgres from "postgres";

const databaseUrl = process.env["DATABASE_URL"]?.trim();
const port = Number(process.env["PORT"] ?? "3003");
const host = process.env["HOST"] ?? "0.0.0.0";

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set");
}

const sql = postgres(databaseUrl, { max: 4 });
const app = Fastify({ logger: true });

type CandleProgress = {
  exchange: string;
  symbol: string;
  timeframe: string;
  candles: string;
  earliest: Date | null;
  latest: Date | null;
  minutes_covered: string | null;
};

type LatestCandle = {
  exchange: string;
  symbol: string;
  timeframe: string;
  time: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  source: string | null;
  repaired: boolean | null;
  exchange_verified: boolean | null;
};

type IngestionEvent = {
  created_at: Date;
  exchange: string | null;
  symbol: string | null;
  timeframe: string | null;
  severity: string | null;
  event_type: string | null;
  message: string | null;
};

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

function formatIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

async function tableExists(table: string) {
  const result = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    ) AS exists
  `;
  return result[0]?.exists ?? false;
}

app.get("/health", async () => ({ ok: true }));

app.get("/api/summary", async () => {
  const [progress, latest, totals, ingestionEventsExists] = await Promise.all([
    sql<CandleProgress[]>`
      SELECT
        exchange,
        symbol,
        timeframe,
        COUNT(*)::text AS candles,
        MIN(time) AS earliest,
        MAX(time) AS latest,
        FLOOR(EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 60)::text AS minutes_covered
      FROM ohlcv
      GROUP BY exchange, symbol, timeframe
      ORDER BY exchange, symbol, timeframe
    `,
    sql<LatestCandle[]>`
      SELECT exchange, symbol, timeframe, time, open, high, low, close, volume,
             source, repaired, exchange_verified
      FROM ohlcv
      ORDER BY time DESC
      LIMIT 80
    `,
    sql<{ candles: string; symbols: string; earliest: Date | null; latest: Date | null }[]>`
      SELECT
        COUNT(*)::text AS candles,
        COUNT(DISTINCT symbol)::text AS symbols,
        MIN(time) AS earliest,
        MAX(time) AS latest
      FROM ohlcv
    `,
    tableExists("ingestion_events"),
  ]);

  const events = ingestionEventsExists
    ? await sql<IngestionEvent[]>`
        SELECT created_at, exchange, symbol, timeframe, severity, event_type, message
        FROM ingestion_events
        ORDER BY created_at DESC
        LIMIT 30
      `
    : [];

  const latestMs = totals[0]?.latest?.getTime();
  const ageSeconds = latestMs ? Math.max(0, Math.round((Date.now() - latestMs) / 1000)) : null;
  const oneMinuteRows = progress.filter((row) => row.timeframe === "1m");
  const canonicalCandles = oneMinuteRows.reduce((sum, row) => sum + toNumber(row.candles), 0);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      candles: toNumber(totals[0]?.candles),
      canonicalCandles,
      symbols: toNumber(totals[0]?.symbols),
      earliest: formatIso(totals[0]?.earliest),
      latest: formatIso(totals[0]?.latest),
      latestAgeSeconds: ageSeconds,
    },
    progress: progress.map((row) => ({
      ...row,
      candles: toNumber(row.candles),
      minutesCovered: toNumber(row.minutes_covered),
      earliest: formatIso(row.earliest),
      latest: formatIso(row.latest),
    })),
    latest: latest.map((row) => ({
      ...row,
      time: row.time.toISOString(),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume),
    })),
    events: events.map((event) => ({
      ...event,
      created_at: event.created_at.toISOString(),
    })),
  };
});

const html = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Trading Bot DB Progress</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #08111f;
      --panel: rgba(15, 23, 42, 0.78);
      --panel-strong: rgba(15, 23, 42, 0.94);
      --line: rgba(148, 163, 184, 0.18);
      --text: #e5edf8;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --good: #34d399;
      --warn: #fbbf24;
      --bad: #fb7185;
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.28), transparent 32rem),
        radial-gradient(circle at 80% 10%, rgba(52, 211, 153, 0.14), transparent 28rem),
        linear-gradient(135deg, #07111f 0%, #0f172a 46%, #111827 100%);
    }
    main { width: min(1220px, calc(100vw - 32px)); margin: 0 auto; padding: 32px 0 44px; }
    header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 24px; }
    h1 { margin: 0; font-size: clamp(30px, 5vw, 56px); letter-spacing: -0.06em; line-height: 0.95; }
    .subtitle { margin-top: 12px; color: var(--muted); max-width: 680px; line-height: 1.55; }
    .status-pill { display: inline-flex; align-items: center; gap: 9px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 999px; background: rgba(15, 23, 42, 0.62); box-shadow: var(--shadow); color: var(--muted); white-space: nowrap; }
    .dot { width: 9px; height: 9px; border-radius: 999px; background: var(--good); box-shadow: 0 0 18px var(--good); }
    .grid { display: grid; gap: 16px; }
    .cards { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 16px; }
    .card, .panel { border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(18px); border-radius: 24px; box-shadow: var(--shadow); }
    .card { padding: 20px; min-height: 126px; position: relative; overflow: hidden; }
    .card::after { content: ""; position: absolute; inset: auto -20% -50% 20%; height: 90px; background: radial-gradient(circle, rgba(56,189,248,.16), transparent 60%); }
    .label { color: var(--muted); font-size: 13px; letter-spacing: .04em; text-transform: uppercase; }
    .value { margin-top: 12px; font-size: 34px; font-weight: 760; letter-spacing: -0.04em; }
    .hint { margin-top: 7px; color: var(--muted); font-size: 13px; }
    .layout { grid-template-columns: minmax(0, 1.15fr) minmax(360px, .85fr); align-items: start; }
    .panel { padding: 20px; overflow: hidden; }
    .panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    h2 { margin: 0; font-size: 18px; letter-spacing: -0.02em; }
    .small { color: var(--muted); font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; padding: 10px 10px; border-bottom: 1px solid var(--line); }
    td { padding: 12px 10px; border-bottom: 1px solid rgba(148,163,184,.10); font-size: 14px; vertical-align: middle; }
    tr:hover td { background: rgba(148, 163, 184, 0.055); }
    .mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .tag { display: inline-flex; align-items: center; border: 1px solid rgba(56,189,248,.28); color: #bae6fd; background: rgba(14,165,233,.11); border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 680; }
    .bar { height: 8px; width: 100%; border-radius: 999px; background: rgba(148,163,184,.14); overflow: hidden; margin-top: 8px; }
    .fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--good)); min-width: 2px; }
    .events { display: grid; gap: 10px; max-height: 510px; overflow: auto; padding-right: 4px; }
    .event { padding: 12px; border: 1px solid rgba(148,163,184,.12); border-radius: 16px; background: rgba(2,6,23,.28); }
    .event-top { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
    .event-msg { color: #cbd5e1; line-height: 1.35; font-size: 13px; }
    .latest-table { margin-top: 16px; max-height: 520px; overflow: auto; }
    .empty { color: var(--muted); padding: 24px; border: 1px dashed var(--line); border-radius: 18px; text-align: center; }
    @media (max-width: 900px) { .cards, .layout { grid-template-columns: 1fr; } header { flex-direction: column; } }
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <h1>Market data<br/>DB progress</h1>
      <div class="subtitle">A lightweight view of OHLCV ingestion, canonical 1m history, recent candles and ingestion events. Auto-refreshes every 10 seconds.</div>
    </div>
    <div class="status-pill"><span class="dot"></span><span id="status">Connecting…</span></div>
  </header>

  <section class="grid cards">
    <div class="card"><div class="label">Total candles</div><div class="value mono" id="totalCandles">—</div><div class="hint">All intervals stored</div></div>
    <div class="card"><div class="label">Canonical 1m</div><div class="value mono" id="canonicalCandles">—</div><div class="hint">Base dataset for derivation</div></div>
    <div class="card"><div class="label">Symbols</div><div class="value mono" id="symbols">—</div><div class="hint">Distinct markets</div></div>
    <div class="card"><div class="label">Freshness</div><div class="value mono" id="freshness">—</div><div class="hint" id="latestTime">Latest candle</div></div>
  </section>

  <section class="grid layout">
    <div class="panel">
      <div class="panel-head"><h2>Fill progress by market</h2><span class="small" id="generatedAt">—</span></div>
      <div style="overflow:auto"><table><thead><tr><th>Market</th><th>TF</th><th>Candles</th><th>Earliest</th><th>Latest</th><th>Span</th></tr></thead><tbody id="progressRows"></tbody></table></div>
      <div class="latest-table"><div class="panel-head"><h2>Latest rows</h2><span class="small">Newest OHLCV records</span></div><table><thead><tr><th>Time</th><th>Market</th><th>TF</th><th>Close</th><th>Volume</th><th>Source</th></tr></thead><tbody id="latestRows"></tbody></table></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Ingestion events</h2><span class="small">Recent</span></div>
      <div class="events" id="events"></div>
    </div>
  </section>
</main>
<script>
  const fmt = new Intl.NumberFormat();
  const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
  function ago(seconds) {
    if (seconds == null) return '—';
    if (seconds < 90) return seconds + 's';
    const mins = Math.round(seconds / 60);
    if (mins < 90) return mins + 'm';
    const hours = Math.round(mins / 60);
    if (hours < 48) return hours + 'h';
    return Math.round(hours / 24) + 'd';
  }
  function shortDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function days(minutes) { return minutes ? (minutes / 1440).toFixed(1) + 'd' : '—'; }
  function esc(value) {
    return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }
  function setText(id, text) { document.getElementById(id).textContent = text; }
  async function refresh() {
    try {
      const res = await fetch('/api/summary', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setText('status', 'Live · refreshed ' + new Date().toLocaleTimeString());
      setText('totalCandles', compact.format(data.totals.candles));
      setText('canonicalCandles', compact.format(data.totals.canonicalCandles));
      setText('symbols', fmt.format(data.totals.symbols));
      setText('freshness', ago(data.totals.latestAgeSeconds));
      setText('latestTime', data.totals.latest ? shortDate(data.totals.latest) : 'Latest candle');
      setText('generatedAt', 'Updated ' + shortDate(data.generatedAt));

      const maxCandles = Math.max(1, ...data.progress.map(r => r.candles));
      document.getElementById('progressRows').innerHTML = data.progress.map(row =>
        '<tr>' +
          '<td><span class="tag">' + esc(row.exchange) + '</span> ' + esc(row.symbol) + '</td>' +
          '<td class="mono">' + esc(row.timeframe) + '</td>' +
          '<td class="mono">' + fmt.format(row.candles) + '<div class="bar"><div class="fill" style="width:' + Math.max(2, row.candles / maxCandles * 100) + '%"></div></div></td>' +
          '<td class="mono">' + shortDate(row.earliest) + '</td>' +
          '<td class="mono">' + shortDate(row.latest) + '</td>' +
          '<td class="mono">' + days(row.minutesCovered) + '</td>' +
        '</tr>').join('');

      document.getElementById('latestRows').innerHTML = data.latest.map(row =>
        '<tr>' +
          '<td class="mono">' + shortDate(row.time) + '</td>' +
          '<td>' + esc(row.symbol) + '</td>' +
          '<td class="mono">' + esc(row.timeframe) + '</td>' +
          '<td class="mono">' + fmt.format(row.close) + '</td>' +
          '<td class="mono">' + fmt.format(Math.round(row.volume * 100) / 100) + '</td>' +
          '<td><span class="tag">' + esc(row.source || 'unknown') + '</span></td>' +
        '</tr>').join('');

      document.getElementById('events').innerHTML = data.events.length ? data.events.map(event =>
        '<div class="event">' +
          '<div class="event-top"><span class="tag">' + esc(event.event_type || 'event') + '</span><span class="small mono">' + shortDate(event.created_at) + '</span></div>' +
          '<div class="small">' + esc([event.exchange, event.symbol, event.timeframe].filter(Boolean).join(' · ') || 'system') + '</div>' +
          '<div class="event-msg">' + esc(event.message || 'No message') + '</div>' +
        '</div>').join('') : '<div class="empty">No ingestion events yet.</div>';
    } catch (error) {
      setText('status', 'Disconnected · ' + error.message);
    }
  }
  refresh();
  setInterval(refresh, 10000);
</script>
</body>
</html>`;

app.get("/", async (_request, reply) => {
  return reply.type("text/html; charset=utf-8").send(html);
});

const close = async () => {
  await app.close();
  await sql.end();
  process.exit(0);
};

process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());

await app.listen({ host, port });
