import { sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  deriveCandlesFromLowerTimeframe,
  insertOrderBookSnapshots,
  upsertMarketTrades,
} from "../queries/marketData";
import { upsertOHLCV } from "../queries/ohlcv";
import { backtestTrades } from "../schema/backtestTrades";
import { backtests } from "../schema/backtests";
import { botLogs } from "../schema/botLogs";
import { botTrades } from "../schema/botTrades";
import { bots } from "../schema/bots";
import { dataCollectionStatus } from "../schema/dataCollection";
import { exchangeConfigs } from "../schema/exchangeConfigs";
import { ingestionEvents } from "../schema/ingestionEvents";
import { ingestionHealth } from "../schema/ingestionHealth";
import { marketTickers } from "../schema/marketTickers";
import { settings } from "../schema/settings";

const TEST_EXCHANGE = "binance";
const TEST_PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT"];
const TEST_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

export async function seedTestingMode(db: Database) {
  const now = floorToMinute(new Date());
  const start = new Date(now.getTime() - 3 * 24 * 60 * 60_000);

  await db
    .insert(settings)
    .values([
      {
        key: "app.mode",
        value: "testing",
        description: "Testing/demo mode is enabled; seeded fake data should be used.",
      },
      {
        key: "collection.pairs",
        value: JSON.stringify(TEST_PAIRS),
        description: "Testing mode trading pairs",
      },
      {
        key: "collection.timeframes",
        value: JSON.stringify(TEST_TIMEFRAMES),
        description: "Testing mode timeframes",
      },
      {
        key: "collection.exchanges",
        value: JSON.stringify([TEST_EXCHANGE]),
        description: "Testing mode exchanges",
      },
    ])
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: sql`excluded.value`, updatedAt: sql`NOW()` },
    });

  await db
    .insert(exchangeConfigs)
    .values({
      exchange: TEST_EXCHANGE,
      enabled: true,
      apiKey: "testing-mode-fake-key",
      apiSecret: "testing-mode-fake-secret",
      sandbox: true,
      metadata: JSON.stringify({ name: "Binance Demo (testing mode)", testing: true }),
    })
    .onConflictDoUpdate({
      target: exchangeConfigs.exchange,
      set: {
        enabled: true,
        sandbox: true,
        metadata: JSON.stringify({ name: "Binance Demo (testing mode)", testing: true }),
        updatedAt: sql`NOW()`,
      },
    });

  for (const [index, symbol] of TEST_PAIRS.entries()) {
    const basePrice = [68_000, 3_800, 165][index] ?? 100;
    await seedPair(db, symbol, basePrice, start, now);
  }

  const [bot] = await db
    .insert(bots)
    .values({
      name: "Demo BTC paper bot",
      strategy: "sma-crossover",
      strategyParams: { fastPeriod: 8, slowPeriod: 21 },
      exchange: TEST_EXCHANGE,
      symbol: "BTC/USDT",
      timeframe: "1m",
      mode: "paper",
      status: "idle",
      currentBalance: "10000",
      totalPnl: "242.55",
      totalTrades: "12",
      winRate: "58.33",
      riskConfig: { maxPositionSize: 0.1, stopLossPct: 2 },
    })
    .returning();

  if (bot) {
    await db.insert(botLogs).values([
      { botId: bot.id, level: "info", message: "Testing mode bot created" },
      { botId: bot.id, level: "info", message: "Canonical fake candles are ready" },
    ]);

    const demoTrades = Array.from({ length: 12 }, (_, i) => {
      const price = 67_000 + i * 95;
      const amount = 0.01 + (i % 3) * 0.002;
      const pnl = i % 4 === 0 ? -18.5 : 34.25;
      return {
        botId: bot.id,
        orderId: `demo-order-${i + 1}`,
        symbol: "BTC/USDT",
        side: i % 2 === 0 ? "buy" : "sell",
        type: "market",
        amount: amount.toString(),
        price: price.toString(),
        cost: (price * amount).toString(),
        fee: "0.25",
        feeCurrency: "USDT",
        pnl: pnl.toString(),
        pnlPercent: ((pnl / 10_000) * 100).toString(),
        reason: "testing-mode-fill",
        executedAt: new Date(now.getTime() - (12 - i) * 30 * 60_000),
      };
    });
    await db.insert(botTrades).values(demoTrades);
  }

  const [backtest] = await db
    .insert(backtests)
    .values({
      name: "Demo SMA Backtest",
      strategy: "sma-crossover",
      strategyParams: { fastPeriod: 8, slowPeriod: 21 },
      exchange: TEST_EXCHANGE,
      symbol: "BTC/USDT",
      timeframe: "1m",
      startTime: start,
      endTime: now,
      initialBalance: "10000",
      finalBalance: "10842.50",
      totalPnl: "842.50",
      totalPnlPercent: "8.4250",
      totalTrades: 28,
      winningTrades: 17,
      losingTrades: 11,
      winRate: "60.71",
      maxDrawdown: "3.2000",
      sharpeRatio: "1.4200",
      profitFactor: "1.8300",
      metrics: { demo: true, equityPoints: 72 },
      status: "completed",
      completedAt: now,
    })
    .returning();

  if (backtest) {
    await db.insert(backtestTrades).values(
      Array.from({ length: 28 }, (_, i) => ({
        backtestId: backtest.id,
        symbol: "BTC/USDT",
        side: i % 2 === 0 ? "buy" : "sell",
        type: "market",
        amount: "0.01",
        price: (66_500 + i * 110).toString(),
        cost: (665 + i * 1.1).toString(),
        fee: "0.20",
        pnl: (i % 3 === 0 ? -12 : 36).toString(),
        pnlPercent: (i % 3 === 0 ? -0.12 : 0.36).toString(),
        balance: (10_000 + i * 30).toString(),
        reason: "testing-mode-backtest",
        executedAt: new Date(start.getTime() + i * 90 * 60_000),
      }))
    );
  }

  await db.insert(ingestionEvents).values({
    eventType: "testing_mode_seeded",
    severity: "info",
    message: "Testing mode fake dataset seeded successfully",
    metadata: { pairs: TEST_PAIRS, exchange: TEST_EXCHANGE, start, end: now },
  });
}

async function seedPair(db: Database, symbol: string, basePrice: number, start: Date, end: Date) {
  const trades = [];
  for (let ts = start.getTime(), i = 0; ts <= end.getTime(); ts += 60_000, i++) {
    const wave = Math.sin(i / 37) * basePrice * 0.01;
    const drift = i * basePrice * 0.000002;
    const price = basePrice + wave + drift;
    trades.push({
      exchange: TEST_EXCHANGE,
      symbol,
      tradeId: `testing-${symbol}-${ts}`,
      side: i % 2 === 0 ? "buy" : "sell",
      price: price.toFixed(8),
      amount: (0.1 + (i % 10) * 0.01).toFixed(8),
      cost: (price * (0.1 + (i % 10) * 0.01)).toFixed(8),
      tradedAt: new Date(ts),
      source: "testing",
      raw: JSON.stringify({ testing: true, ts }),
    });
  }

  await upsertMarketTrades(db, trades);

  const oneMinute = trades.map((trade, i) => {
    const open = Number(trade.price);
    const close = open * (1 + Math.sin(i / 11) * 0.0008);
    const high = Math.max(open, close) * 1.0005;
    const low = Math.min(open, close) * 0.9995;
    return {
      exchange: TEST_EXCHANGE,
      symbol,
      timeframe: "1m",
      time: trade.tradedAt,
      open: open.toFixed(8),
      high: high.toFixed(8),
      low: low.toFixed(8),
      close: close.toFixed(8),
      volume: trade.amount,
      tradesCount: 1,
    };
  });
  await upsertOHLCV(db, oneMinute);

  for (const timeframe of TEST_TIMEFRAMES.filter((tf) => tf !== "1m")) {
    const derived = await deriveCandlesFromLowerTimeframe(db, {
      exchange: TEST_EXCHANGE,
      symbol,
      sourceTimeframe: "1m",
      targetTimeframe: timeframe,
      startTime: start,
      endTime: end,
    });
    await upsertOHLCV(db, derived);
  }

  const latest = end;
  await db
    .insert(dataCollectionStatus)
    .values(
      TEST_TIMEFRAMES.map((timeframe) => ({
        exchange: TEST_EXCHANGE,
        symbol,
        timeframe,
        earliest: start,
        latest,
        totalCandles: timeframe === "1m" ? oneMinute.length : Math.floor(oneMinute.length / 5),
        gapCount: 0,
        status: "idle",
        lastCollectedAt: new Date(),
      }))
    )
    .onConflictDoNothing();

  await db
    .insert(ingestionHealth)
    .values(
      TEST_TIMEFRAMES.map((timeframe) => ({
        id: `${TEST_EXCHANGE}:${symbol}:${timeframe}`,
        exchange: TEST_EXCHANGE,
        symbol,
        timeframe,
        latestCandleAt: latest,
        latestEventAt: latest,
        websocketStatus: "testing",
        completenessBps: 10000,
        candlesInserted: oneMinute.length,
      }))
    )
    .onConflictDoNothing();

  await db.insert(marketTickers).values({
    id: `${TEST_EXCHANGE}:${symbol}:testing-ticker`,
    exchange: TEST_EXCHANGE,
    symbol,
    bid: (basePrice * 0.999).toFixed(8),
    ask: (basePrice * 1.001).toFixed(8),
    last: basePrice.toFixed(8),
    volume: "123456.78900000",
    change24h: "2.3400",
    tickerAt: latest,
    source: "testing",
    raw: JSON.stringify({ testing: true }),
  });

  await insertOrderBookSnapshots(db, [
    {
      exchange: TEST_EXCHANGE,
      symbol,
      bids: Array.from({ length: 50 }, (_, i) => [
        Number((basePrice * (1 - (i + 1) * 0.0005)).toFixed(8)),
        Number((1 + i * 0.15).toFixed(8)),
      ]),
      asks: Array.from({ length: 50 }, (_, i) => [
        Number((basePrice * (1 + (i + 1) * 0.0005)).toFixed(8)),
        Number((1 + i * 0.15).toFixed(8)),
      ]),
      snapshotAt: latest,
      source: "testing",
      raw: JSON.stringify({ testing: true }),
    },
  ]);
}

function floorToMinute(date: Date) {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000);
}
