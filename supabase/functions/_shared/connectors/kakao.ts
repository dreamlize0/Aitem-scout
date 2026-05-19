// Kakao Daum Search API — blog + web.
// Docs: https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide
// Auth: header `Authorization: KakaoAK <REST_API_KEY>`.

import { getEnv } from "../env.ts";
import { timedFetch } from "../http.ts";
import { UpstreamError, withRetry } from "../retry.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

const KAKAO_BLOG = "https://dapi.kakao.com/v2/search/blog";
const KAKAO_WEB = "https://dapi.kakao.com/v2/search/web";

export const kakaoConnector: SourceConnector = {
  name: "kakao",
  enabled: () => Boolean(getEnv("KAKAO_REST_API_KEY")),

  async fetch({ query }: ConnectorContext): Promise<RawItem[]> {
    const key = getEnv("KAKAO_REST_API_KEY")!;
    const headers = { Authorization: `KakaoAK ${key}` };

    const [blogRes, webRes] = await Promise.allSettled([
      withRetry(() => kakaoGet<KakaoBlogResp>(KAKAO_BLOG, query, headers)),
      withRetry(() => kakaoGet<KakaoWebResp>(KAKAO_WEB, query, headers)),
    ]);

    // Mirror naver: surface failure only when BOTH endpoints fail so the
    // orchestrator marks the source as failed. Partial success returns whatever
    // landed.
    if (blogRes.status === "rejected" && webRes.status === "rejected") {
      throw blogRes.reason instanceof Error
        ? blogRes.reason
        : new Error("Kakao blog and web endpoints both failed");
    }

    const items: RawItem[] = [];

    if (blogRes.status === "fulfilled") {
      for (const r of blogRes.value.documents ?? []) {
        items.push({
          id: `kakao-blog-${hash(r.url)}`,
          title: stripHtml(r.title),
          summary: stripHtml(r.contents),
          thumbnail_url: r.thumbnail || undefined,
          source_url: r.url,
          source_platform: "kakao",
          metadata: { kind: "blog", blogname: r.blogname, datetime: r.datetime },
          citations: [{ platform: "kakao", url: r.url, excerpt: stripHtml(r.contents) }],
        });
      }
    }

    if (webRes.status === "fulfilled") {
      for (const r of webRes.value.documents ?? []) {
        items.push({
          id: `kakao-web-${hash(r.url)}`,
          title: stripHtml(r.title),
          summary: stripHtml(r.contents),
          source_url: r.url,
          source_platform: "kakao",
          metadata: { kind: "web", datetime: r.datetime },
          citations: [{ platform: "kakao", url: r.url, excerpt: stripHtml(r.contents) }],
        });
      }
    }

    return items;
  },
};

interface KakaoBlogDoc {
  title: string;
  contents: string;
  url: string;
  blogname?: string;
  thumbnail?: string;
  datetime?: string;
}
interface KakaoWebDoc {
  title: string;
  contents: string;
  url: string;
  datetime?: string;
}
interface KakaoBlogResp { documents: KakaoBlogDoc[] }
interface KakaoWebResp { documents: KakaoWebDoc[] }

async function kakaoGet<T>(url: string, query: string, headers: Record<string, string>): Promise<T> {
  const target = `${url}?query=${encodeURIComponent(query)}&size=10&sort=accuracy`;
  const res = await timedFetch(target, { headers });
  if (!res.ok) throw new UpstreamError(res.status, `Kakao ${url} ${res.status}`);
  return (await res.json()) as T;
}

function stripHtml(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
