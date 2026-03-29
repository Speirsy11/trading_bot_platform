import type {
  Bot,
  BotMetrics,
  Candle,
  OpenOrder,
  OrderBookLevel,
  PortfolioSummary,
  Position,
  Trade,
} from "./types";

function mulberry32(seed: number) {
  return function random() {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260329);

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function pick<T>(values: T[]) {
  return values[Math.floor(random() * values.length)] as T;
}

const portfolio: PortfolioSummary = {
  totalValue: 127450.83,
  dailyChangePct: 3.2,
  totalPnl: 8421.14,
  cashBalance: 16432.9,
  allocations: [
    { symbol: "BTC", weight: 45, value: 57352.87 },
    { symbol: "ETH", weight: 30, value: 38235.25 },
    { symbol: "SOL", weight: 15, value: 19117.62 },
    { symbol: "LINK", weight: 6, value: 7647.05 },
    { symbol: "USDC", weight: 4, value: 5098.04 },
  ],
};

const candles: Candle[] = [];
let previousClose = 94125;
const startTime = Math.floor(Date.now() / 1000) - 60 * 60 * 200;

for (let index = 0; index < 200; index += 1) {
  const drift = (random() - 0.46) * 720;
  const open = previousClose;
  const close = Math.max(100, open + drift);
  const high = Math.max(open, close) + random() * 220;
  const low = Math.min(open, close) - random() * 210;

  candles.push({
    time: startTime + index * 3600,
    open: round(open),
    high: round(high),
    low: round(low),
    close: round(close),
    volume: round(350 + random() * 1600, 0),
  });

  previousClose = close;
}

const bots: Bot[] = [
  {
    id: "bot-1",
    name: "Atlas Pulse",
    exchange: "Binance",
    pair: "BTC/USDT",
    strategy: "SMA Crossover",
    status: "running",
    pnl: 4210.22,
    pnlPct: 8.4,
    mode: "live",
  },
  {
    id: "bot-2",
    name: "Riptide Mean",
    exchange: "Bybit",
    pair: "ETH/USDT",
    strategy: "RSI Mean Reversion",
    status: "running",
    pnl: 1918.64,
    pnlPct: 5.2,
    mode: "paper",
  },
  {
    id: "bot-3",
    name: "Nova Breakout",
    exchange: "OKX",
    pair: "SOL/USDT",
    strategy: "Bollinger Breakout",
    status: "running",
    pnl: 3032.4,
    pnlPct: 11.1,
    mode: "live",
  },
  {
    id: "bot-4",
    name: "Drift Maker",
    exchange: "Kraken",
    pair: "LINK/USDT",
    strategy: "Market Making",
    status: "stopped",
    pnl: -412.15,
    pnlPct: -1.9,
    mode: "paper",
  },
  {
    id: "bot-5",
    name: "Kumo Grid",
    exchange: "Coinbase",
    pair: "BTC/USDT",
    strategy: "Grid Executor",
    status: "stopped",
    pnl: 622.81,
    pnlPct: 1.3,
    mode: "paper",
  },
  {
    id: "bot-6",
    name: "Sigma Trail",
    exchange: "Binance",
    pair: "ETH/USDT",
    strategy: "Trend Follower",
    status: "paused",
    pnl: 1028.76,
    pnlPct: 2.8,
    mode: "live",
  },
  {
    id: "bot-7",
    name: "Sentinel Arb",
    exchange: "Bybit",
    pair: "BTC/USDT",
    strategy: "Latency Arbitrage",
    status: "error",
    pnl: -823.08,
    pnlPct: -3.4,
    mode: "live",
  },
];

const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "LINK/USDT"];
const trades: Trade[] = Array.from({ length: 18 }, (_, index) => {
  const side = random() > 0.48 ? "buy" : "sell";
  return {
    id: `trade-${index + 1}`,
    timestamp: new Date(Date.now() - index * 17 * 60 * 1000).toISOString(),
    symbol: pick(symbols),
    side,
    price: round(1500 + random() * 94000),
    amount: round(0.02 + random() * 2.4, 4),
    fee: round(2 + random() * 18),
  };
});

const mid = candles.at(-1)?.close ?? 94000;
const bids: OrderBookLevel[] = [];
const asks: OrderBookLevel[] = [];
let bidRunningTotal = 0;
let askRunningTotal = 0;

for (let level = 0; level < 18; level += 1) {
  const bidAmount = round(0.35 + random() * 2.5, 4);
  const askAmount = round(0.35 + random() * 2.5, 4);
  bidRunningTotal += bidAmount;
  askRunningTotal += askAmount;

  bids.push({
    price: round(mid - level * 12.5 - random() * 3),
    amount: bidAmount,
    total: round(bidRunningTotal, 4),
  });
  asks.push({
    price: round(mid + level * 12.5 + random() * 3),
    amount: askAmount,
    total: round(askRunningTotal, 4),
  });
}

const openOrders: OpenOrder[] = [
  {
    id: "order-1",
    symbol: "BTC/USDT",
    side: "buy",
    type: "limit",
    price: round(mid - 245),
    amount: 0.18,
    status: "pending",
  },
  {
    id: "order-2",
    symbol: "BTC/USDT",
    side: "sell",
    type: "limit",
    price: round(mid + 310),
    amount: 0.11,
    status: "partial",
  },
  {
    id: "order-3",
    symbol: "ETH/USDT",
    side: "buy",
    type: "market",
    price: 0,
    amount: 3.5,
    status: "pending",
  },
  {
    id: "order-4",
    symbol: "SOL/USDT",
    side: "sell",
    type: "limit",
    price: 194.2,
    amount: 28,
    status: "pending",
  },
];

const positions: Position[] = [
  {
    id: "pos-1",
    symbol: "BTC/USDT",
    side: "long",
    size: 0.84,
    entryPrice: 92110,
    markPrice: round(mid),
    unrealizedPnl: round((mid - 92110) * 0.84),
  },
  {
    id: "pos-2",
    symbol: "ETH/USDT",
    side: "long",
    size: 6.4,
    entryPrice: 3420,
    markPrice: 3518,
    unrealizedPnl: round((3518 - 3420) * 6.4),
  },
  {
    id: "pos-3",
    symbol: "SOL/USDT",
    side: "short",
    size: 112,
    entryPrice: 201.4,
    markPrice: 194.2,
    unrealizedPnl: round((201.4 - 194.2) * 112),
  },
];

const botMetrics: Record<string, BotMetrics> = Object.fromEntries(
  bots.map((bot, index) => [
    bot.id,
    {
      sharpe: round(0.8 + random() * 2.1, 2),
      winRate: round(48 + random() * 26, 1),
      maxDrawdown: round(4 + random() * 12, 1),
      profitFactor: round(1.1 + random() * 1.8, 2),
      totalReturn: round(bot.pnlPct + index * 0.6, 1),
    },
  ])
);

export const mockData = {
  portfolio,
  candles,
  bots,
  orderBook: {
    bids,
    asks,
  },
  trades,
  openOrders,
  positions,
  botMetrics,
};
