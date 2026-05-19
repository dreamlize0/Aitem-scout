// Google Trends — no official API. We use the public widget JSON endpoint
// (used by trends.google.com). If SERPAPI_KEY is set, we fall back to SerpAPI
// for a more stable path.

import { getEnv } from "../env.ts";
import { timedFetch } from "../http.ts";
import { UpstreamError, withRetry } from "../retry.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

export const googleTrendsConnector: SourceConnector = {
  name: "google_trends",
  // Was: `() => true` and falling back to a public widget endpoint that Google
  // breaks every few months (response prefix stripping is fragile, no key, easy
  // IP throttling). Without SERPAPI_KEY we now stay disabled rather than spam
  // failed connector logs on every search. PRD's graceful-degradation policy
  // accepts a missing source — LLM still infers trend from other metadata.
  enabled: () => Boolean(getEnv("SERPAPI_KEY")),

  async fetch({ query, filters }: ConnectorContext): Promise<RawItem[]> {
    const serpKey = getEnv("SERPAPI_KEY");
    if (serpKey) {
      try {
        return await fetchViaSerpAPI(query, serpKey, filters.locale);
      } catch (err) {
        console.warn("[google_trends] SerpAPI failed, falling back to public widget", err);
      }
    }
    return await fetchViaPublicWidget(query, filters.locale ?? "ko-KR");
  },
};

async function fetchViaSerpAPI(query: string, key: string, locale: string | undefined): Promise<RawItem[]> {
  const params = new URLSearchParams({
    engine: "google_trends",
    q: query,
    data_type: "TIMESERIES",
    api_key: key,
    hl: locale ?? "ko-KR",
  });
  const json = await withRetry(async () => {
    const res = await timedFetch(`https://serpapi.com/search?${params.toString()}`);
    if (!res.ok) throw new UpstreamError(res.status, `SerpAPI ${res.status}`);
    return await res.json();
  });
  const series = (json?.interest_over_time?.timeline_data ?? []) as Array<{
    date: string;
    values: Array<{ extracted_value: number }>;
  }>;
  return [
    {
      id: `gtrends-${slug(query)}`,
      title: `Google Trends: ${query}`,
      summary: `시계열 데이터 ${series.length}개 포인트`,
      source_url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}`,
      source_platform: "google_trends",
      metadata: {
        timeline: series.map((p) => ({ label: p.date, value: p.values[0]?.extracted_value ?? 0 })),
      },
      citations: [{
        platform: "google_trends",
        url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}`,
      }],
    },
  ];
}

async function fetchViaPublicWidget(query: string, locale: string): Promise<RawItem[]> {
  // Step 1: get widget token.
  const reqJson = {
    comparisonItem: [{ keyword: query, geo: "", time: "today 12-m" }],
    category: 0,
    property: "",
  };
  const url1 = `https://trends.google.com/trends/api/explore?hl=${encodeURIComponent(locale)}&tz=-540&req=${encodeURIComponent(JSON.stringify(reqJson))}`;
  const token = await withRetry(async () => {
    const res = await timedFetch(url1);
    if (!res.ok) throw new UpstreamError(res.status, `gtrends explore ${res.status}`);
    const raw = await res.text();
    const stripped = raw.replace(/^\)]\}',?\s*/, "");
    const parsed = JSON.parse(stripped) as { widgets: Array<{ id: string; token: string; request: unknown }> };
    const tl = parsed.widgets.find((w) => w.id === "TIMESERIES");
    if (!tl) throw new Error("No TIMESERIES widget");
    return tl;
  });

  // Step 2: fetch the timeseries with the token.
  const url2 = `https://trends.google.com/trends/api/widgetdata/multiline?hl=${encodeURIComponent(locale)}&tz=-540&req=${encodeURIComponent(JSON.stringify(token.request))}&token=${token.token}`;
  const timeline = await withRetry(async () => {
    const res = await timedFetch(url2);
    if (!res.ok) throw new UpstreamError(res.status, `gtrends widgetdata ${res.status}`);
    const raw = await res.text();
    const stripped = raw.replace(/^\)]\}',?\s*/, "");
    const parsed = JSON.parse(stripped) as { default: { timelineData: Array<{ formattedTime: string; value: number[] }> } };
    return parsed.default.timelineData.map((d) => ({ label: d.formattedTime, value: d.value?.[0] ?? 0 }));
  });

  return [
    {
      id: `gtrends-${slug(query)}`,
      title: `Google Trends: ${query}`,
      summary: `최근 12개월 시계열 (${timeline.length}개 포인트)`,
      source_url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}`,
      source_platform: "google_trends",
      metadata: { timeline },
      citations: [{
        platform: "google_trends",
        url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}`,
      }],
    },
  ];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").slice(0, 32);
}
