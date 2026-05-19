// /functions/v1/businesses — Naver 지역검색 wrapper.
//
// GET /businesses?q=<query>
//
// Surfaces up to 5 real, contactable Korean businesses matching the query.
// Used by the detail panel so an item group like "남대문 화장품" turns into
// actual cosmetics shops the user can call/visit, rather than just article
// citations. Korean focus — Naver Local has near-zero international coverage,
// but the project's primary audience targets Korean content creators.

import { corsPreflight, fail, handleUnknownError, ok } from "../_shared/response.ts";
import { AuthError, requireUser } from "../_shared/auth.ts";
import { getEnv } from "../_shared/env.ts";
import { timedFetch } from "../_shared/http.ts";

interface NaverLocalItem {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

interface Business {
  name: string;
  category: string;
  description: string;
  road_address: string;
  jibun_address: string;
  telephone: string;
  link: string;
  map_url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "GET") {
    return fail("VALIDATION_ERROR", `Method ${req.method} not allowed`, { status: 405 });
  }

  try {
    await requireUser(req);
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    if (!q) return fail("VALIDATION_ERROR", "`q` is required");

    const clientId = getEnv("NAVER_CLIENT_ID");
    const clientSecret = getEnv("NAVER_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return fail("UPSTREAM_FAILED", "Naver API credentials missing");
    }

    const params = new URLSearchParams({ query: q, display: "5", sort: "random" });
    const res = await timedFetch(
      `https://openapi.naver.com/v1/search/local.json?${params.toString()}`,
      {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return fail("UPSTREAM_FAILED", `Naver Local ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { items?: NaverLocalItem[] };
    const businesses: Business[] = (json.items ?? []).map(toBusiness);
    return ok({ items: businesses });
  } catch (err) {
    if (err instanceof AuthError) return fail("UNAUTHORIZED", err.message);
    return handleUnknownError(err);
  }
});

function toBusiness(i: NaverLocalItem): Business {
  const name = stripTags(i.title);
  // Naver Map's stable deep-link is a search URL — coordinate-based deep
  // links break between Naver Map's v4/v5/v6 layouts, but the search URL
  // has been stable for years.
  const mapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(name)}`;
  return {
    name,
    category: i.category,
    description: stripTags(i.description),
    road_address: i.roadAddress,
    jibun_address: i.address,
    telephone: i.telephone,
    link: i.link,
    map_url: mapUrl,
  };
}

function stripTags(s: string): string {
  // Naver wraps matched terms in <b>…</b>; strip all HTML defensively.
  return s.replace(/<[^>]*>/g, "");
}
