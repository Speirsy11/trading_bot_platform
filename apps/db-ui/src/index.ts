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

const binanceSpotStartDates: Record<string, string> = {
  "ADA/USDT": "2018-04-17T04:02:00.000Z",
  "BCH/USDT": "2019-11-28T10:00:00.000Z",
  "BNB/USDT": "2017-11-06T03:54:00.000Z",
  "BTC/USDT": "2017-08-17T04:00:00.000Z",
  "DOGE/USDT": "2019-07-05T12:00:00.000Z",
  "ETH/USDT": "2017-08-17T04:00:00.000Z",
  "SOL/USDT": "2020-08-11T06:00:00.000Z",
  "TRX/USDT": "2018-06-11T11:30:00.000Z",
  "XRP/USDT": "2018-05-04T08:11:00.000Z",
  "ZEC/USDT": "2019-03-21T04:00:00.000Z",
};

const defaultExchangeStartDates: Record<string, string> = {
  binance: "2017-08-17T00:00:00.000Z",
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

function oneMinuteCandlesBetween(start: Date | null | undefined, end: Date) {
  if (!start) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000) + 1);
}

function historicalStart(exchange: string, symbol: string) {
  const configured = exchange === "binance" ? binanceSpotStartDates[symbol] : undefined;
  return new Date(configured ?? defaultExchangeStartDates[exchange] ?? "2017-01-01T00:00:00.000Z");
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function fromHarvesterSymbol(symbol: string) {
  if (symbol.endsWith("USDT")) return `${symbol.slice(0, -4)}/USDT`;
  if (symbol.endsWith("USD")) return `${symbol.slice(0, -3)}/USD`;
  return symbol;
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
  const [markets, ingestionEventsExists] = await Promise.all([
    sql<
      Array<{
        exchange: string;
        symbol: string;
        timeframe: string;
        candles: string;
        earliest: Date | null;
        latest: Date | null;
        minutes_covered: string | null;
        time: Date | null;
        open: string | null;
        high: string | null;
        low: string | null;
        close: string | null;
        volume: string | null;
        source: string | null;
        repaired: boolean | null;
        exchange_verified: boolean | null;
      }>
    >`
      SELECT
        b.provider AS exchange,
        b.symbol,
        b.interval AS timeframe,
        b.total_inserted::text AS candles,
        b.start_time AS earliest,
        latest.timestamp AS latest,
        CASE
          WHEN b.start_time IS NOT NULL AND latest.timestamp IS NOT NULL
          THEN FLOOR(EXTRACT(EPOCH FROM (latest.timestamp - b.start_time)) / 60)::text
          ELSE NULL
        END AS minutes_covered,
        latest.timestamp AS time,
        latest.open::text AS open,
        latest.high::text AS high,
        latest.low::text AS low,
        latest.close::text AS close,
        COALESCE(latest.volume, 0)::text AS volume,
        latest.source_name AS source,
        false AS repaired,
        true AS exchange_verified
      FROM market_data_backfills b
      LEFT JOIN LATERAL (
        SELECT timestamp, open, high, low, close, volume, source_name
        FROM market_data_points p
        WHERE p.provider = b.provider
          AND p.symbol = b.symbol
          AND p.interval = b.interval
        ORDER BY timestamp DESC
        LIMIT 1
      ) latest ON true
      ORDER BY b.provider, b.symbol, b.interval
    `,
    tableExists("ingestion_events"),
  ]);

  const progress: CandleProgress[] = markets.map((row) => ({
    exchange: row.exchange,
    symbol: row.symbol,
    timeframe: row.timeframe,
    candles: row.candles,
    earliest: row.earliest,
    latest: row.latest,
    minutes_covered: row.minutes_covered,
  }));
  const latest: LatestCandle[] = markets
    .filter((row) => row.time && row.timeframe === "1m")
    .map((row) => ({
      exchange: row.exchange,
      symbol: row.symbol,
      timeframe: row.timeframe,
      time: row.time as Date,
      open: row.open ?? "0",
      high: row.high ?? "0",
      low: row.low ?? "0",
      close: row.close ?? "0",
      volume: row.volume ?? "0",
      source: row.source,
      repaired: row.repaired,
      exchange_verified: row.exchange_verified,
    }));

  const configuredExchanges = unique(progress.map((row) => row.exchange));
  const configuredSymbols = unique(
    progress.filter((row) => row.timeframe === "1m").map((row) => fromHarvesterSymbol(row.symbol))
  );
  const configuredMarkets = configuredExchanges.flatMap((exchange) =>
    configuredSymbols.map((symbol) => ({ exchange, symbol, timeframe: "1m" }))
  );

  const events = ingestionEventsExists
    ? await sql<IngestionEvent[]>`
        SELECT created_at, exchange, symbol, timeframe, severity, event_type, message
        FROM ingestion_events
        ORDER BY created_at DESC
        LIMIT 30
      `
    : [];

  const progressByMarket = new Map(
    progress.map((row) => [
      `${row.exchange}:${fromHarvesterSymbol(row.symbol)}:${row.timeframe}`,
      row,
    ])
  );
  const latestByMarket = new Map(
    latest.map((row) => [
      `${row.exchange}:${fromHarvesterSymbol(row.symbol)}:${row.timeframe}`,
      row,
    ])
  );
  const oneMinuteRows = progress.filter((row) => row.timeframe === "1m");
  const canonicalCandles = oneMinuteRows.reduce((sum, row) => sum + toNumber(row.candles), 0);
  const latestTimes = oneMinuteRows.flatMap((row) => (row.latest ? [row.latest.getTime()] : []));
  const earliestTimes = oneMinuteRows.flatMap((row) =>
    row.earliest ? [row.earliest.getTime()] : []
  );
  const latestMs = latestTimes.length > 0 ? Math.max(...latestTimes) : null;
  const earliestMs = earliestTimes.length > 0 ? Math.min(...earliestTimes) : null;
  const ageSeconds = latestMs ? Math.max(0, Math.round((Date.now() - latestMs) / 1000)) : null;
  const latestAvailable = new Date(Date.now() - 60_000);

  const progressRows = configuredMarkets.map((market) => {
    const row = progressByMarket.get(`${market.exchange}:${market.symbol}:${market.timeframe}`);
    const candles = toNumber(row?.candles);
    const targetStart = historicalStart(market.exchange, market.symbol);
    const expectedCandles = oneMinuteCandlesBetween(targetStart, latestAvailable);
    const storedWindowExpected = row ? oneMinuteCandlesBetween(row.earliest, latestAvailable) : 0;
    return {
      ...market,
      candles,
      expectedCandles,
      storedWindowExpected,
      missingHistoricalCandles: Math.max(0, expectedCandles - candles),
      fillPercent: expectedCandles > 0 ? Math.min(100, (candles / expectedCandles) * 100) : 0,
      storedWindowFillPercent:
        storedWindowExpected > 0 ? Math.min(100, (candles / storedWindowExpected) * 100) : 0,
      minutesCovered: toNumber(row?.minutes_covered),
      targetStart: formatIso(targetStart),
      earliest: formatIso(row?.earliest),
      latest: formatIso(row?.latest),
      latestAvailable: latestAvailable.toISOString(),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    configuredMarkets,
    totals: {
      candles: canonicalCandles,
      canonicalCandles,
      symbols: configuredSymbols.length,
      storedSymbols: configuredSymbols.length,
      earliest: earliestMs ? new Date(earliestMs).toISOString() : null,
      latest: latestMs ? new Date(latestMs).toISOString() : null,
      latestAgeSeconds: ageSeconds,
    },
    progress: progressRows,
    latest: configuredMarkets.map((market) => {
      const row = latestByMarket.get(`${market.exchange}:${market.symbol}:${market.timeframe}`);
      return row
        ? {
            ...row,
            symbol: fromHarvesterSymbol(row.symbol),
            time: row.time.toISOString(),
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: Number(row.volume),
          }
        : {
            ...market,
            time: null,
            open: null,
            high: null,
            low: null,
            close: null,
            volume: null,
            source: null,
          };
    }),
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
    main { width: min(1380px, calc(100vw - 32px)); margin: 0 auto; padding: 32px 0 44px; }
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
    .market-pair { grid-template-columns: 1fr 1fr; align-items: stretch; margin-bottom: 16px; }
    .wide { margin-bottom: 16px; }
    .history-table, .scroll { overflow:auto; }
    .equal-panel { min-height: 650px; }
    .nowrap { white-space: nowrap; }.metric { color: var(--text); font-weight: 760; }
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
    @media (max-width: 900px) { .cards, .layout, .market-pair { grid-template-columns: 1fr; } header { flex-direction: column; } .equal-panel { min-height: 0; } }
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <h1>Market data<br/>DB progress</h1>
      <div class="subtitle">A lightweight view of live OHLCV ingestion plus historical Binance 1m backfill. Live and historical collection are shown separately for all configured markets so partial history is not mistaken for complete coverage.</div>
    </div>
    <div class="status-pill"><span class="dot"></span><span id="status">Connecting…</span></div>
  </header>

  <section class="grid cards">
    <div class="card"><div class="label">Total candles</div><div class="value mono" id="totalCandles">—</div><div class="hint">All intervals stored</div></div>
    <div class="card"><div class="label">Canonical 1m</div><div class="value mono" id="canonicalCandles">—</div><div class="hint">Base dataset for derivation</div></div>
    <div class="card"><div class="label">Symbols</div><div class="value mono" id="symbols">—</div><div class="hint">Distinct markets</div></div>
    <div class="card"><div class="label">Freshness</div><div class="value mono" id="freshness">—</div><div class="hint" id="latestTime">Latest candle</div></div>
  </section>

  <section class="grid market-pair">
    <div class="panel equal-panel">
      <div class="panel-head"><h2>Live 1m collection</h2><span class="small">Newest candle per market</span></div>
      <div class="small" style="margin-bottom:12px">One latest 1m candle per configured market. This is live freshness only — it does not imply historical backfill is complete.</div>
      <div class="scroll"><table><thead><tr><th>Market</th><th>Status</th><th>Candle time</th><th>Close</th><th>Volume</th><th>Source</th></tr></thead><tbody id="latestRows"></tbody></table></div>
    </div>
    <div class="panel equal-panel">
      <div class="panel-head"><h2>Historical collection</h2><span class="small" id="generatedAt">—</span></div>
      <div class="small" style="margin-bottom:12px">Backfill progress per market. Progress is stored 1m candles divided by the full expected Binance 1m history for that market, using explicit Binance first-candle dates for all 10 tracked symbols.</div>
      <div class="history-table"><table><thead><tr><th>Market</th><th>Stored / expected</th><th>Progress</th><th>Target start</th><th>Earliest stored</th><th>Latest stored</th></tr></thead><tbody id="progressRows"></tbody></table></div>
    </div>
  </section>

  <section class="panel wide">
    <div class="panel-head"><h2>Ingestion events</h2><span class="small">Recent</span></div>
    <div class="events" id="events"></div>
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
  function fullDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
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

      const historicalRows = data.progress.filter(row => row.timeframe === '1m');
      document.getElementById('progressRows').innerHTML = historicalRows.map(row =>
        '<tr>' +
          '<td><span class="tag">' + esc(row.exchange) + '</span> ' + esc(row.symbol) + '<div class="small mono">' + esc(row.timeframe) + '</div></td>' +
          '<td class="mono"><span class="metric">' + fmt.format(row.candles) + '</span> / ' + fmt.format(row.expectedCandles) + '<div class="small">missing ' + fmt.format(row.missingHistoricalCandles) + ' historical 1m candles</div></td>' +
          '<td class="mono"><span class="metric">' + row.fillPercent.toFixed(3) + '%</span><div class="bar"><div class="fill" style="width:' + Math.max(0.2, row.fillPercent) + '%"></div></div><div class="small">stored-window fill ' + row.storedWindowFillPercent.toFixed(2) + '%</div></td>' +
          '<td class="mono nowrap">' + fullDate(row.targetStart) + '</td>' +
          '<td class="mono nowrap">' + fullDate(row.earliest) + '</td>' +
          '<td class="mono nowrap">' + fullDate(row.latest) + '</td>' +
        '</tr>').join('');

      document.getElementById('latestRows').innerHTML = data.latest.map(row => {
        const ageSeconds = row.time ? Math.max(0, Math.round((Date.now() - new Date(row.time).getTime()) / 1000)) : null;
        const status = ageSeconds == null ? 'missing' : ageSeconds <= 180 ? 'live' : ageSeconds <= 1800 ? 'lagging' : 'stale';
        return '<tr>' +
          '<td>' + esc(row.symbol) + '<div class="small mono">' + esc(row.exchange) + ' · ' + esc(row.timeframe) + '</div></td>' +
          '<td><span class="tag">' + status + '</span><div class="small">' + (ageSeconds == null ? 'No row stored yet' : ago(ageSeconds) + ' behind') + '</div></td>' +
          '<td class="mono nowrap">' + fullDate(row.time) + '</td>' +
          '<td class="mono">' + (row.close == null ? '—' : fmt.format(row.close)) + '</td>' +
          '<td class="mono">' + (row.volume == null ? '—' : fmt.format(Math.round(row.volume * 100) / 100)) + '</td>' +
          '<td><span class="tag">' + esc(row.source || 'unknown') + '</span></td>' +
        '</tr>';
      }).join('');

      document.getElementById('events').innerHTML = data.events.length ? data.events.map(event =>
        '<div class="event">' +
          '<div class="event-top"><span class="tag">' + esc(event.event_type || 'event') + '</span><span class="small mono">' + fullDate(event.created_at) + '</span></div>' +
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
