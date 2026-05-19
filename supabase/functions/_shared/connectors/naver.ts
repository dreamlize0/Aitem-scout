// Naver Search API — blog + shopping.
// Docs: https://developers.naver.com/docs/serviceapi/search/blog/blog.md
//       https://developers.naver.com/docs/serviceapi/search/shop/shop.md

import { getEnv } from "../env.ts";
import { timedFetch } from "../http.ts";
import { UpstreamError, withRetry } from "../retry.ts";
import type { RawItem } from "../types.ts";
import type { ConnectorContext, SourceConnector } from "./base.ts";

const NAVER_BLOG = "https://openapi.naver.com/v1/search/blog.json";
const NAVER_SHOP = "https://openapi.naver.com/v1/search/shop.json";

export const naverConnector: SourceConnector = {
  name: "naver",
  enabled: () => Boolean(getEnv("NAVER_CLIENT_ID") && getEnv("NAVER_CLIENT_SECRET")),

  async fetch({ query }: ConnectorContext): Promise<RawItem[]> {
    const clientId = getEnv("NAVER_CLIENT_ID")!;
    const clientSecret = getEnv("NAVER_CLIENT_SECRET")!;
    const headers = {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    };

    const [blogRes, shopRes] = await Promise.allSettled([
      withRetry(() => naverGet(NAVER_BLOG, query, headers)),
      withRetry(() => naverGet(NAVER_SHOP, query, headers)),
    ]);

    // If BOTH endpoints failed, surface that to the orchestrator so the user
    // sees "naver" in connectors.failed. Partial success (one fulfilled) still
    // returns whatever it got.
    if (blogRes.status === "rejected" && shopRes.status === "rejected") {
      throw blogRes.reason instanceof Error
        ? blogRes.reason
        : new Error("Naver blog and shop endpoints both failed");
    }

    const items: RawItem[] = [];

    if (blogRes.status === "fulfilled") {
      for (const r of blogRes.value.items ?? []) {
        items.push({
          id: `naver-blog-${hash(r.link)}`,
          title: stripHtml(r.title),
          summary: stripHtml(r.description),
          source_url: r.link,
          source_platform: "naver",
          metadata: { kind: "blog", bloggername: r.bloggername, postdate: r.postdate },
          citations: [{ platform: "naver", url: r.link, excerpt: stripHtml(r.description) }],
        });
      }
    }

    if (shopRes.status === "fulfilled") {
      for (const r of shopRes.value.items ?? []) {
        items.push({
          id: `naver-shop-${hash(r.productId ?? r.link)}`,
          title: stripHtml(r.title),
          summary: r.category1 ? `${r.category1} > ${r.category2 ?? ""}` : undefined,
          thumbnail_url: r.image,
          source_url: r.link,
          source_platform: "naver",
          metadata: { kind: "shop", price: r.lprice, mall: r.mallName },
          citations: [{ platform: "naver", url: r.link, excerpt: stripHtml(r.title) }],
        });
      }
    }

    return items;
  },
};

interface NaverItemBlog {
  title: string;
  link: string;
  description: string;
  bloggername?: string;
  postdate?: string;
}
interface NaverItemShop {
  title: string;
  link: string;
  image?: string;
  lprice?: string;
  mallName?: string;
  productId?: string;
  category1?: string;
  category2?: string;
}
interface NaverResp {
  items: Array<NaverItemBlog & NaverItemShop>;
}

async function naverGet(url: string, query: string, headers: Record<string, string>): Promise<NaverResp> {
  const target = `${url}?query=${encodeURIComponent(query)}&display=10&sort=sim`;
  const res = await timedFetch(target, { headers });
  if (!res.ok) throw new UpstreamError(res.status, `Naver ${url} ${res.status}`);
  return (await res.json()) as NaverResp;
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
