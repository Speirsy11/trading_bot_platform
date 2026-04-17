export const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  LTC: "litecoin",
  ATOM: "cosmos",
};

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  price_change_percentage_24h: number | null;
}

const BASE_URL = "https://api.coingecko.com/api/v3";

export class CoinGeckoClient {
  async fetchMarketData(coinIds: string[]): Promise<CoinMarketData[]> {
    const ids = coinIds.join(",");
    const url = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${ids}&per_page=100&page=1`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<CoinMarketData[]>;
  }
}
