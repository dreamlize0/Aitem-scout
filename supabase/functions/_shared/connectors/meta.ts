// Instagram via Apify hashtag scraper (apify/instagram-hashtag-scraper).
// Replaces direct Meta Graph API usage so the project doesn't need a Meta
// business account + Instagram Graph approval. Pricing: ~$1.90 / 1k results.

import { hasApifyToken, runApifyActor } from "../apify.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

const ACTOR_ID = "apify/instagram-hashtag-scraper";

export const metaConnector: SourceConnector = {
  name: "meta",
  enabled: () => hasApifyToken(),

  async fetch({ query }: ConnectorContext): Promise<RawItem[]> {
    const tag = query.replace(/[^a-zA-Z0-9가-힣]/g, "").slice(0, 50);
    if (!tag) return [];

    const items = await runApifyActor<ApifyInstagramPost>(ACTOR_ID, {
      hashtags: [tag],
      resultsLimit: 10,
      addParentData: false,
    });

    // The actor can succeed and still return [] — e.g. a hashtag with no
    // recent public posts, or Instagram blocking the scrape session. We log
    // the first item's keys (without leaking content) so we can tell at a
    // glance whether the actor returned an unexpected shape vs simply 0 hits.
    if (items.length === 0) {
      console.warn(`[meta] actor returned 0 items for hashtag "${tag}"`);
    } else {
      console.log(`[meta] actor returned ${items.length} items, first item keys:`, Object.keys(items[0]));
    }

    return items.slice(0, 8).flatMap((p): RawItem[] => {
      const shortCode = p.shortCode ?? p.id;
      if (!shortCode) return [];
      const url = p.url ?? `https://www.instagram.com/p/${shortCode}/`;
      const caption = p.caption ?? "";
      return [{
        id: `ig-${shortCode}`,
        title: truncate(caption || "Instagram post", 80),
        summary: caption || undefined,
        thumbnail_url: p.displayUrl ?? p.thumbnailUrl,
        source_url: url,
        source_platform: "instagram",
        metadata: {
          likes: p.likesCount,
          comments: p.commentsCount,
          posted_at: p.timestamp,
          media_type: p.type,
        },
        citations: [{
          platform: "instagram",
          url,
          excerpt: truncate(caption, 200),
        }],
      }];
    });
  },
};

interface ApifyInstagramPost {
  id?: string;
  shortCode?: string;
  caption?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  url?: string;
  type?: string;
  likesCount?: number;
  commentsCount?: number;
  timestamp?: string;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
