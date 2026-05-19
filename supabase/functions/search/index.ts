// /functions/v1/search — main pipeline.
//   1) validate request
//   2) cache lookup (unless force_refresh)
//   3) connector fan-out (graceful degradation)
//   4) LLM report generation (Claude Sonnet 4.6, prompt-cached system prompt)
//   5) cache write + search_logs entry

import { corsPreflight, fail, handleUnknownError, ok } from "../_shared/response.ts";
import { AuthError, requireUser } from "../_shared/auth.ts";
import { getCached, makeCacheKey, setCache } from "../_shared/cache.ts";
import { fanout } from "../_shared/orchestrator.ts";
import { generateReport, LlmError } from "../_shared/llm/claude.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import type {
  ConnectorFailure,
  ReportItem,
  SearchFilters,
  SearchRequest,
  SearchResponseData,
  SearchTarget,
} from "../_shared/types.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return fail("VALIDATION_ERROR", `Method ${req.method} not allowed`, { status: 405 });
  }

  const startedAt = Date.now();
  let userId: string | null = null;

  try {
    try {
      const user = await requireUser(req);
      userId = user.userId;
    } catch (err) {
      if (err instanceof AuthError) return fail("UNAUTHORIZED", err.message);
      throw err;
    }

    const body = await safeJson(req);
    if (!body || typeof body.query !== "string" || body.query.trim().length === 0) {
      return fail("VALIDATION_ERROR", "`query` is required");
    }
    const reqBody: SearchRequest = {
      query: body.query.trim(),
      filters: normalizeFilters(body.filters),
      force_refresh: body.force_refresh === true,
    };
    const filters = reqBody.filters ?? {};

    // 2) cache
    const cacheKey = await makeCacheKey(reqBody.query, filters);
    if (!reqBody.force_refresh) {
      const cached = await getCached(cacheKey);
      if (cached) {
        const elapsed = Date.now() - startedAt;
        await logSearch({
          userId,
          query: reqBody.query,
          filters,
          succeeded: cached.connectors.succeeded,
          failed: cached.connectors.failed,
          cacheHit: true,
          latencyMs: elapsed,
        });
        return ok<SearchResponseData>({ ...cached, cache_hit: true, latency_ms: elapsed });
      }
    }

    // 3) connectors
    const { items: rawItems, succeeded, failed, trendTimeline } = await fanout(reqBody.query, filters);

    // 4) LLM
    let report: SearchResponseData["report"];
    let reasonsById = new Map<string, string>();
    // Maps each id LLM ranked to its index in the LLM output (0 = top pick).
    // Items not ranked by LLM go to the bottom of the result list.
    const llmRank = new Map<string, number>();
    let llmFailed = false;

    if (rawItems.length === 0) {
      report = {
        summary: "현재 활성화된 외부 데이터 소스에서 결과를 찾지 못했습니다. 다른 키워드로 시도하거나 필터를 완화해 보세요.",
        trend_score: 0,
        top_themes: [],
        global_trend_chart: trendTimeline,
      };
    } else {
      try {
        const llm = await generateReport({
          query: reqBody.query,
          filters,
          succeeded,
          failed,
          trendTimeline,
          candidates: rawItems.map((i) => ({
            id: i.id,
            title: i.title,
            summary: i.summary,
            source_platform: i.source_platform,
            metadata: i.metadata,
          })),
        });
        report = {
          summary: llm.summary,
          trend_score: llm.trend_score,
          top_themes: llm.top_themes,
          global_trend_chart: llm.global_trend_chart ?? trendTimeline,
        };
        reasonsById = new Map(llm.items.map((r) => [r.id, r.recommendation_reason]));
        llm.items.forEach((r, idx) => llmRank.set(r.id, idx));
      } catch (err) {
        console.error("[search] LLM failed; returning raw items without recommendations", err);
        llmFailed = true;
        failed.push({
          name: "llm",
          code: err instanceof LlmError ? "LLM_FAILED" : "UPSTREAM_FAILED",
          message: err instanceof Error ? err.message : undefined,
        });
        report = {
          summary: `${rawItems.length}개 후보 아이템을 수집했으나 AI 리포트 생성에 일시적 오류가 발생했습니다.`,
          trend_score: 0,
          top_themes: [],
          global_trend_chart: trendTimeline,
        };
      }
    }

    // Merge LLM reasoning into raw items; preserve order LLM produced when available.
    const finalItems: ReportItem[] = rawItems
      .filter((i) => i.source_platform !== "google_trends") // trend data lives in the report
      .map((i) => ({ ...i, recommendation_reason: reasonsById.get(i.id) }))
      // LLM-ranked items first in LLM's order; unranked items keep raw order
      // after that (Array.sort is stable in modern JS engines).
      .sort((a, b) => {
        const ra = llmRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const rb = llmRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return ra - rb;
      })
      .slice(0, 24);

    const latencyMs = Date.now() - startedAt;
    const responseData: SearchResponseData = {
      cache_hit: false,
      latency_ms: latencyMs,
      connectors: { succeeded, failed },
      report,
      items: finalItems,
    };

    // 5) persist
    // Don't cache LLM-failed responses — otherwise a transient Anthropic outage
    // freezes a degraded fallback for the full TTL (24h). force_refresh would
    // still recover, but most users won't know to ask. logSearch still records
    // the attempt for ops visibility.
    if (!llmFailed) await setCache(cacheKey, responseData);
    await logSearch({
      userId,
      query: reqBody.query,
      filters,
      succeeded,
      failed,
      cacheHit: false,
      latencyMs,
    });

    return ok<SearchResponseData>(responseData);
  } catch (err) {
    return handleUnknownError(err);
  }
});

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Defensive filter parser — silently drops fields with the wrong shape rather
// than 400-ing the whole request. Frontend already enforces shape via the UI,
// but direct API callers (or future internal services) can be sloppy. Anything
// the user surely meant comes through; junk is stripped.
const VALID_GENDERS = new Set(["male", "female", "any"]);
const VALID_AGES = new Set(["10-20", "20-30", "30-40", "40-50", "50+", "any"]);

function normalizeFilters(raw: unknown): SearchFilters {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: SearchFilters = {};

  if (Array.isArray(r.theme)) {
    const themes = r.theme.filter((t): t is string => typeof t === "string");
    if (themes.length > 0) out.theme = themes;
  }

  if (r.target && typeof r.target === "object") {
    const t = r.target as Record<string, unknown>;
    const target: SearchTarget = {};
    if (typeof t.gender === "string" && VALID_GENDERS.has(t.gender)) {
      target.gender = t.gender as SearchTarget["gender"];
    }
    if (typeof t.age_range === "string" && VALID_AGES.has(t.age_range)) {
      target.age_range = t.age_range as SearchTarget["age_range"];
    }
    if (typeof t.lifestyle === "string" && t.lifestyle.trim().length > 0) {
      target.lifestyle = t.lifestyle.trim();
    }
    if (Object.keys(target).length > 0) out.target = target;
  }

  if (typeof r.locale === "string" && r.locale.trim().length > 0) {
    out.locale = r.locale.trim();
  }

  if (Array.isArray(r.global_targets)) {
    const codes = r.global_targets.filter((g): g is string => typeof g === "string");
    if (codes.length > 0) out.global_targets = codes;
  }

  return out;
}

interface LogParams {
  userId: string | null;
  query: string;
  filters: unknown;
  succeeded: string[];
  failed: ConnectorFailure[];
  cacheHit: boolean;
  latencyMs: number;
}

async function logSearch(p: LogParams): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from("search_logs").insert({
      user_id: p.userId,
      query: p.query,
      filters: p.filters,
      connectors_used: p.succeeded,
      connectors_failed: p.failed.map((f) => f.name),
      cache_hit: p.cacheHit,
      latency_ms: p.latencyMs,
    });
  } catch (err) {
    console.error("[search.logSearch]", err);
  }
}
