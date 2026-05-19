// search_caches helper: deterministic key from normalized query+filters,
// TTL configurable via SEARCH_CACHE_TTL_SECONDS (default 24h).

import { CACHE_TTL_SECONDS } from "./env.ts";
import { getServiceClient } from "./supabase.ts";
import type { SearchFilters, SearchResponseData } from "./types.ts";

// Bump when the response shape changes so the new code never serves an old
// payload from cache (the DB column is jsonb so old shapes won't 500 — they
// just won't have the fields the UI now expects).
const CACHE_SCHEMA_VERSION = 3;

export async function makeCacheKey(
  query: string,
  filters: SearchFilters | undefined,
): Promise<string> {
  const normalized = {
    v: CACHE_SCHEMA_VERSION,
    q: query.trim().toLowerCase(),
    f: sortObject(filters ?? {}),
  };
  const buf = new TextEncoder().encode(JSON.stringify(normalized));
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sortObject<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map(sortObject) as unknown as T;
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      out[key] = sortObject((input as Record<string, unknown>)[key]);
    }
    return out as unknown as T;
  }
  return input;
}

export async function getCached(cacheKey: string): Promise<SearchResponseData | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("search_caches")
    .select("payload, expires_at")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error("[cache.getCached]", error);
    return null;
  }
  return (data?.payload as SearchResponseData) ?? null;
}

export async function setCache(
  cacheKey: string,
  payload: SearchResponseData,
  ttlSeconds: number = CACHE_TTL_SECONDS,
): Promise<void> {
  const supabase = getServiceClient();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const { error } = await supabase
    .from("search_caches")
    .upsert(
      { cache_key: cacheKey, payload, expires_at: expiresAt },
      { onConflict: "cache_key" },
    );
  if (error) console.error("[cache.setCache]", error);
}
