// Threads API — keyword search.
// Docs: https://developers.facebook.com/docs/threads/keyword-search
// Requires a Threads access token (user-scoped).

import { getEnv } from "../env.ts";
import { timedFetch } from "../http.ts";
import { UpstreamError, withRetry } from "../retry.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

const ENDPOINT = "https://graph.threads.net/v1.0/keyword_search";

export const threadsConnector: SourceConnector = {
  name: "threads",
  enabled: () => Boolean(getEnv("THREADS_ACCESS_TOKEN")),

  async fetch({ query }: ConnectorContext): Promise<RawItem[]> {
    const token = getEnv("THREADS_ACCESS_TOKEN")!;
    const fields = "id,text,permalink,timestamp,username,media_type,media_url";
    const params = new URLSearchParams({
      q: query,
      search_type: "TOP",
      fields,
      access_token: token,
    });

    const json = await withRetry(async () => {
      const res = await timedFetch(`${ENDPOINT}?${params.toString()}`);
      if (!res.ok) throw new UpstreamError(res.status, `Threads ${res.status}`);
      return (await res.json()) as ThreadsResp;
    });

    return (json.data ?? []).slice(0, 10).map((t) => ({
      id: `threads-${t.id}`,
      title: truncate(t.text ?? `Thread by @${t.username ?? "anon"}`, 90),
      summary: t.text,
      thumbnail_url: t.media_url,
      source_url: t.permalink,
      source_platform: "threads" as const,
      metadata: { username: t.username, timestamp: t.timestamp, media_type: t.media_type },
      citations: [{ platform: "threads" as const, url: t.permalink, excerpt: truncate(t.text ?? "", 200) }],
    }));
  },
};

interface ThreadsResp {
  data?: Array<{
    id: string;
    text?: string;
    permalink: string;
    timestamp?: string;
    username?: string;
    media_type?: string;
    media_url?: string;
  }>;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
