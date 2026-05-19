// X (Twitter) via Apify tweet scraper (apidojo/tweet-scraper). Replaces the
// official X API v2 because that requires a paid developer plan for any
// non-trivial search throughput. Pricing: ~$0.40 / 1k tweets, minimum 50
// tweets per query (we slice to 10 for downstream display but pay for ~50).

import { hasApifyToken, runApifyActor } from "../apify.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

const ACTOR_ID = "apidojo/tweet-scraper";

// Country -> primary language used for search filtering. Picks the first
// global_target if present so a user choosing "🇯🇵 일본" actually gets Japanese
// tweets; otherwise defaults to Korean for the home market.
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
  enabled: () => hasApifyToken(),

  async fetch({ query, filters }: ConnectorContext): Promise<RawItem[]> {
    const country = filters.global_targets?.[0]?.toUpperCase();
    const lang = (country && COUNTRY_LANG[country]) ?? "ko";

    const items = await runApifyActor<ApifyTweet>(ACTOR_ID, {
      searchTerms: [query],
      maxItems: 50, // actor enforces a 50-minimum per query
      tweetLanguage: lang,
      sort: "Top",
    });

    return items.slice(0, 10).flatMap((t): RawItem[] => {
      const id = t.id ?? t.id_str;
      if (!id) return [];
      const handle = t.author?.userName ?? t.author?.screen_name ?? "i";
      const url = t.url ?? `https://x.com/${handle}/status/${id}`;
      const text = t.text ?? t.fullText ?? "";
      return [{
        id: `x-${id}`,
        title: truncate(text, 90),
        summary: text || undefined,
        source_url: url,
        source_platform: "x",
        thumbnail_url: t.author?.profilePicture ?? t.author?.profile_image_url,
        metadata: {
          metrics: {
            likes: t.likeCount,
            retweets: t.retweetCount,
            replies: t.replyCount,
            views: t.viewCount,
          },
          created_at: t.createdAt ?? t.created_at,
          author: handle,
        },
        citations: [{
          platform: "x",
          url,
          excerpt: truncate(text, 200),
        }],
      }];
    });
  },
};

interface ApifyTweet {
  id?: string;
  id_str?: string;
  text?: string;
  fullText?: string;
  url?: string;
  createdAt?: string;
  created_at?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  author?: {
    userName?: string;
    screen_name?: string;
    profilePicture?: string;
    profile_image_url?: string;
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
