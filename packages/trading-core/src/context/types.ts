export type ExternalContextKind =
  | "news_sentiment"
  | "market_feature"
  | "macro"
  | "onchain"
  | "social";

export interface ExternalContextEvent {
  id: string;
  source: string;
  kind: ExternalContextKind | string;
  asset?: string | null;
  symbol?: string | null;
  publishedAt: string;
  receivedAt?: string;
  title?: string | null;
  url?: string | null;
  score?: number | null;
  confidence?: number | null;
  payload?: Record<string, unknown>;
}

export interface SentimentSummary {
  topic: string;
  windowHours: number;
  documents: number;
  averageScore: number;
  positive: number;
  neutral: number;
  negative: number;
  latestPublishedAt?: string | null;
}

export interface ContextQuery {
  topic: string;
  from: Date;
  to: Date;
  limit?: number;
}

export interface StrategyContextProvider {
  getEvents(query: ContextQuery): Promise<ExternalContextEvent[]>;
  getSentimentSummary(query: {
    topic: string;
    asOf: Date;
    windowHours: number;
  }): Promise<SentimentSummary>;
}

export class NullStrategyContextProvider implements StrategyContextProvider {
  async getEvents(): Promise<ExternalContextEvent[]> {
    return [];
  }

  async getSentimentSummary(query: {
    topic: string;
    asOf: Date;
    windowHours: number;
  }): Promise<SentimentSummary> {
    return {
      topic: query.topic,
      windowHours: query.windowHours,
      documents: 0,
      averageScore: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      latestPublishedAt: null,
    };
  }
}

export class InMemoryStrategyContextProvider implements StrategyContextProvider {
  constructor(private readonly events: ExternalContextEvent[]) {}

  async getEvents(query: ContextQuery): Promise<ExternalContextEvent[]> {
    return this.events
      .filter((event) => {
        const publishedAt = new Date(event.publishedAt);
        const assetMatches = event.asset === query.topic || event.symbol === `${query.topic}/USDT`;
        return assetMatches && publishedAt >= query.from && publishedAt <= query.to;
      })
      .slice(0, query.limit ?? 100);
  }

  async getSentimentSummary(query: {
    topic: string;
    asOf: Date;
    windowHours: number;
  }): Promise<SentimentSummary> {
    const from = new Date(query.asOf.getTime() - query.windowHours * 3_600_000);
    const events = await this.getEvents({
      topic: query.topic,
      from,
      to: query.asOf,
      limit: 10_000,
    });
    const scored = events.filter((event) => typeof event.score === "number");
    const averageScore = scored.length
      ? scored.reduce((sum, event) => sum + (event.score ?? 0), 0) / scored.length
      : 0;
    return {
      topic: query.topic,
      windowHours: query.windowHours,
      documents: events.length,
      averageScore,
      positive: scored.filter((event) => (event.score ?? 0) > 0.1).length,
      neutral: scored.filter((event) => Math.abs(event.score ?? 0) <= 0.1).length,
      negative: scored.filter((event) => (event.score ?? 0) < -0.1).length,
      latestPublishedAt: events.at(-1)?.publishedAt ?? null,
    };
  }
}
