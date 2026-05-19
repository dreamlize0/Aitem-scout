// YouTube Data API v3 — search.list
// Docs: https://developers.google.com/youtube/v3/docs/search/list

import { getEnv } from "../env.ts";
import { timedFetch } from "../http.ts";
import { UpstreamError, withRetry } from "../retry.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

const ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

export const youtubeConnector: SourceConnector = {
  name: "youtube",
  enabled: () => Boolean(getEnv("YOUTUBE_API_KEY")),

  async fetch({ query, filters }: ConnectorContext): Promise<RawItem[]> {
    const key = getEnv("YOUTUBE_API_KEY")!;
    const params = new URLSearchParams({
      key,
      q: query,
      part: "snippet",
      type: "video",
      maxResults: "12",
      order: "relevance",
    });
    // Region priority: first global_target (e.g. user picked "🇯🇵 일본")
    //   -> locale country suffix (ko-KR -> KR)
    //   -> KR fallback
    const region =
      filters.global_targets?.[0]?.toUpperCase() ??
      filters.locale?.split("-")[1]?.toUpperCase() ??
      "KR";
    params.set("regionCode", region);

    const json = await withRetry(async () => {
      const res = await timedFetch(`${ENDPOINT}?${params.toString()}`);
      if (!res.ok) throw new UpstreamError(res.status, `YouTube ${res.status}`);
      return (await res.json()) as YouTubeResp;
    });

    return (json.items ?? [])
      .filter((it) => it.id?.videoId)
      .map((it) => {
        const videoId = it.id!.videoId!;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        return {
          id: `yt-${videoId}`,
          title: it.snippet?.title ?? "",
          summary: it.snippet?.description ?? "",
          thumbnail_url:
            it.snippet?.thumbnails?.high?.url ??
            it.snippet?.thumbnails?.medium?.url ??
            it.snippet?.thumbnails?.default?.url,
          source_url: url,
          source_platform: "youtube" as const,
          metadata: {
            channel: it.snippet?.channelTitle,
            published_at: it.snippet?.publishedAt,
          },
          citations: [{ platform: "youtube" as const, url, excerpt: it.snippet?.description }],
        };
      });
  },
};

interface YouTubeResp {
  items: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        default?: { url: string };
        medium?: { url: string };
        high?: { url: string };
      };
    };
  }>;
}
