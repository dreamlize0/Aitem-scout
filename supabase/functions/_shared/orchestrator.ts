// Multi-connector fan-out with graceful degradation.
// Returns successful items + per-connector failure breakdown.

import { ALL_CONNECTORS } from "./connectors/index.ts";
import { UpstreamError } from "./retry.ts";
import type { ConnectorFailure, RawItem, SearchFilters } from "./types.ts";

export interface FanoutResult {
  items: RawItem[];
  succeeded: string[];
  failed: ConnectorFailure[];
  trendTimeline: Array<{ label: string; value: number }>;
}

export async function fanout(query: string, filters: SearchFilters): Promise<FanoutResult> {
  const active = ALL_CONNECTORS.filter((c) => c.enabled());
  const results = await Promise.allSettled(
    active.map(async (c) => ({
      name: c.name,
      items: await c.fetch({ query, filters }),
    })),
  );

  const items: RawItem[] = [];
  const succeeded: string[] = [];
  const failed: ConnectorFailure[] = [];
  let trendTimeline: Array<{ label: string; value: number }> = [];
  // Dedup across connectors by source_url. Same article can surface from
  // multiple sources (e.g. a Naver blog post indexed by Kakao web search, or
  // a Tavily hit overlapping a YouTube link). Connector registration order in
  // `connectors/index.ts` determines which copy wins.
  const seenUrls = new Set<string>();

  // Per-connector item count for diagnosis. A connector can "succeed" (no
  // error thrown) and still return zero — for example tavily returning 0 hits
  // for a niche query, or a connector that quietly failed auth pre-deploy.
  // Logging here surfaces those silent-zero cases in supabase function logs.
  const perConnector: Record<string, number> = {};

  results.forEach((r, idx) => {
    const name = active[idx].name;
    if (r.status === "fulfilled") {
      succeeded.push(name);
      perConnector[name] = r.value.items.length;
      for (const it of r.value.items) {
        const url = normalizeUrl(it.source_url);
        if (url && seenUrls.has(url)) continue;
        if (url) seenUrls.add(url);
        if (it.source_platform === "google_trends") {
          const tl = (it.metadata?.timeline as Array<{ label: string; value: number }> | undefined) ?? [];
          if (tl.length > trendTimeline.length) trendTimeline = tl;
        }
        items.push(it);
      }
    } else {
      perConnector[name] = -1;
      // Surface the upstream error message — without this we just see "-1"
      // in [fanout.counts] and have to add ad-hoc logging to each connector.
      console.error(`[fanout.error:${name}]`, r.reason);
      failed.push(classify(name, r.reason));
    }
  });

  console.log("[fanout.counts]", JSON.stringify(perConnector));
  return { items, succeeded, failed, trendTimeline };
}

// Strip protocol case, default port, trailing slash, and the most common
// tracking params so trivially-different URLs collapse to one. Conservative
// on purpose — meaningful query params (e.g. ?v= on YouTube, ?productId= on
// shops) are kept.
function normalizeUrl(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.toLowerCase();
    u.hash = "";
    for (const p of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]) {
      u.searchParams.delete(p);
    }
    const s = u.toString();
    return s.endsWith("/") && u.pathname === "/" && !u.search ? s.slice(0, -1) : s;
  } catch {
    return raw;
  }
}

function classify(name: string, err: unknown): ConnectorFailure {
  if (err instanceof UpstreamError) {
    if (err.status === 429) return { name, code: "RATE_LIMITED", message: err.message };
    if (err.status === 401 || err.status === 403) return { name, code: "FORBIDDEN", message: err.message };
    return { name, code: "UPSTREAM_FAILED", message: err.message };
  }
  return {
    name,
    code: "UPSTREAM_FAILED",
    message: err instanceof Error ? err.message : "Unknown failure",
  };
}
