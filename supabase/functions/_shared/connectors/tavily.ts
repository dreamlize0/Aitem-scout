// Tavily web search — POST /search.
// Docs: https://docs.tavily.com/

import { getEnv } from "../env.ts";
import { timedFetch } from "../http.ts";
import { UpstreamError, withRetry } from "../retry.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

const ENDPOINT = "https://api.tavily.com/search";

export const tavilyConnector: SourceConnector = {
  name: "tavily",
  enabled: () => Boolean(getEnv("TAVILY_API_KEY")),

  async fetch({ query }: ConnectorContext): Promise<RawItem[]> {
    const key = getEnv("TAVILY_API_KEY")!;
    const body = JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      max_results: 10,
      include_answer: false,
    });

    const json = await withRetry(async () => {
      const res = await timedFetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new UpstreamError(res.status, `Tavily ${res.status}`);
      return (await res.json()) as TavilyResp;
    });

    return (json.results ?? []).map((r) => ({
      id: `tavily-${hash(r.url)}`,
      title: r.title,
      summary: truncate(r.content ?? "", 220),
      source_url: r.url,
      source_platform: "web" as const,
      metadata: { score: r.score, published_date: r.published_date },
      citations: [{ platform: "web" as const, url: r.url, excerpt: truncate(r.content ?? "", 200) }],
    }));
  },
};

interface TavilyResp {
  results?: Array<{
    title: string;
    url: string;
    content?: string;
    score?: number;
    published_date?: string;
  }>;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
