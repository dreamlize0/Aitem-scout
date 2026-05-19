// X (Twitter) API v2 — recent search.
// Docs: https://developer.x.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent

import { getEnv } from "../env.ts";
import { timedFetch } from "../http.ts";
import { UpstreamError, withRetry } from "../retry.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

const ENDPOINT = "https://api.x.com/2/tweets/search/recent";

// Country -> primary language used for search filtering. We pick the first
// global_target if present so a user choosing "🇯🇵 일본" actually gets Japanese
// tweets; otherwise we default to Korean for the home market.
const COUNTRY_LANG: Record<string, string> = {
  JP: "ja",
  US: "en",
  CN: "zh",
  TW: "zh",
  TH: "th",
  VN: "vi",
  KR: "ko",
};

export const xConnector: SourceConnector = {
  name: "x",
  enabled: () => Boolean(getEnv("X_BEARER_TOKEN")),

  async fetch({ query, filters }: ConnectorContext): Promise<RawItem[]> {
    const token = getEnv("X_BEARER_TOKEN")!;
    const country = filters.global_targets?.[0]?.toUpperCase();
    const lang = (country && COUNTRY_LANG[country]) ?? "ko";
    const params = new URLSearchParams({
      query: `${query} -is:retweet lang:${lang}`,
      max_results: "20",
      "tweet.fields": "public_metrics,created_at,entities,author_id",
      expansions: "author_id",
      "user.fields": "username,name,profile_image_url",
    });
    const json = await withRetry(async () => {
      const res = await timedFetch(`${ENDPOINT}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new UpstreamError(res.status, `X ${res.status}`);
      return (await res.json()) as XResp;
    });

    const users = new Map<string, XUser>();
    for (const u of json.includes?.users ?? []) users.set(u.id, u);

    return (json.data ?? []).slice(0, 10).map((t) => {
      const user = t.author_id ? users.get(t.author_id) : undefined;
      const handle = user?.username ?? "i";
      const url = `https://x.com/${handle}/status/${t.id}`;
      return {
        id: `x-${t.id}`,
        title: truncate(t.text, 90),
        summary: t.text,
        source_url: url,
        source_platform: "x" as const,
        thumbnail_url: user?.profile_image_url,
        metadata: {
          metrics: t.public_metrics,
          created_at: t.created_at,
          author: user?.username,
        },
        citations: [{ platform: "x" as const, url, excerpt: truncate(t.text, 200) }],
      };
    });
  },
};

interface XResp {
  data?: Array<{
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    public_metrics?: Record<string, number>;
  }>;
  includes?: { users?: XUser[] };
}
interface XUser {
  id: string;
  username: string;
  name?: string;
  profile_image_url?: string;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
