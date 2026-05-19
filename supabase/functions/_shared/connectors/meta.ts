// Meta (Instagram Graph API) — hashtag search.
// Docs: https://developers.facebook.com/docs/instagram-api/guides/hashtag-search
// Flow: GET /ig_hashtag_search?user_id=...&q=... -> hashtag id -> GET /{id}/top_media

import { getEnv } from "../env.ts";
import { timedFetch } from "../http.ts";
import { UpstreamError, withRetry } from "../retry.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

const BASE = "https://graph.facebook.com/v19.0";

export const metaConnector: SourceConnector = {
  name: "meta",
  enabled: () => Boolean(getEnv("META_ACCESS_TOKEN") && getEnv("META_IG_BUSINESS_ID")),

  async fetch({ query }: ConnectorContext): Promise<RawItem[]> {
    const token = getEnv("META_ACCESS_TOKEN")!;
    const userId = getEnv("META_IG_BUSINESS_ID")!;
    const tag = query.replace(/[^a-zA-Z0-9가-힣]/g, "").slice(0, 50);
    if (!tag) return [];

    const hashtagId = await withRetry(async () => {
      const url = `${BASE}/ig_hashtag_search?user_id=${userId}&q=${encodeURIComponent(tag)}&access_token=${token}`;
      const res = await timedFetch(url);
      if (!res.ok) throw new UpstreamError(res.status, `Meta hashtag search ${res.status}`);
      const json = (await res.json()) as { data: Array<{ id: string }> };
      return json.data?.[0]?.id;
    });
    if (!hashtagId) return [];

    const fields = "id,media_type,caption,permalink,media_url,thumbnail_url,timestamp,like_count";
    const mediaUrl = `${BASE}/${hashtagId}/top_media?user_id=${userId}&fields=${fields}&access_token=${token}`;
    const media = await withRetry(async () => {
      const res = await timedFetch(mediaUrl);
      if (!res.ok) throw new UpstreamError(res.status, `Meta top_media ${res.status}`);
      return (await res.json()) as { data: Array<MetaMedia> };
    });

    return (media.data ?? []).slice(0, 8).map((m) => ({
      id: `ig-${m.id}`,
      title: truncate(m.caption ?? `Instagram post`, 80),
      summary: m.caption ?? undefined,
      thumbnail_url: m.thumbnail_url ?? m.media_url,
      source_url: m.permalink,
      source_platform: "instagram" as const,
      metadata: { likes: m.like_count, posted_at: m.timestamp, media_type: m.media_type },
      citations: [{ platform: "instagram" as const, url: m.permalink, excerpt: truncate(m.caption ?? "", 200) }],
    }));
  },
};

interface MetaMedia {
  id: string;
  media_type?: string;
  caption?: string;
  permalink: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  like_count?: number;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
