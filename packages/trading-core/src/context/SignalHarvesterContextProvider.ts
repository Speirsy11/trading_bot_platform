import type { ExternalContextEvent, SentimentSummary, StrategyContextProvider } from "./types";

export class SignalHarvesterContextProvider implements StrategyContextProvider {
  constructor(private readonly baseUrl: string) {}

  async getEvents(query: {
    topic: string;
    from: Date;
    to: Date;
    limit?: number;
  }): Promise<ExternalContextEvent[]> {
    const url = new URL("/api/context/events", this.baseUrl);
    url.searchParams.set("topic", query.topic);
    url.searchParams.set("from", query.from.toISOString());
    url.searchParams.set("to", query.to.toISOString());
    if (query.limit) url.searchParams.set("limit", String(query.limit));
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Signal Harvester context request failed: ${response.status}`);
    return (await response.json()) as ExternalContextEvent[];
  }

  async getSentimentSummary(query: {
    topic: string;
    asOf: Date;
    windowHours: number;
  }): Promise<SentimentSummary> {
    const from = new Date(query.asOf.getTime() - query.windowHours * 3_600_000);
    const events = await this.getEvents({ topic: query.topic, from, to: query.asOf, limit: 500 });
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
