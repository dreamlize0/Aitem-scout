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
  ItemGroup,
  RawItem,
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
    let groups: ItemGroup[] = [];
    let llmFailed = false;

    // Items that flow into the LLM (and into evidence) — trend data lives in
    // the report's chart, not in any group.
    const evidenceCandidates = rawItems.filter((i) => i.source_platform !== "google_trends");

    if (evidenceCandidates.length === 0) {
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
          candidates: evidenceCandidates.map((i) => ({
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
        groups = resolveGroups(llm.item_groups, evidenceCandidates);

        // Visibility: when groups drop to 0 the UI shows "결과가 없습니다", so
        // log enough to diagnose which side broke (LLM emitted no groups vs.
        // emitted bad evidence_ids that didn't match the candidate pool).
        if (groups.length === 0) {
          console.warn(
            "[search.groups.empty]",
            JSON.stringify({
              llm_groups: llm.item_groups.map((g) => ({
                name: g.name,
                type: g.type,
                evidence_ids: g.evidence_ids,
              })),
              candidate_ids: evidenceCandidates.map((i) => i.id),
            }),
          );
          // Fallback: rather than render a blank "no results" page next to the
          // full AI report, surface raw evidence under a single main group
          // with the user's query as the label. Better degraded UX than 0.
          groups = [{
            name: reqBody.query,
            type: "main",
            recommendation_reason: "",
            evidence: evidenceCandidates.slice(0, 12).map((i) => ({ ...i })),
          }];
        }
      } catch (err) {
        console.error("[search] LLM failed; returning raw items without recommendations", err);
        llmFailed = true;
        failed.push({
          name: "llm",
          code: err instanceof LlmError ? "LLM_FAILED" : "UPSTREAM_FAILED",
          message: err instanceof Error ? err.message : undefined,
        });
        report = {
          summary: `${evidenceCandidates.length}개 후보 아이템을 수집했으나 AI 리포트 생성에 일시적 오류가 발생했습니다.`,
          trend_score: 0,
          top_themes: [],
          global_trend_chart: trendTimeline,
        };
        // LLM-less fallback: one "main" group with the user's query as name
        // and all evidence below. Better than dropping the search entirely.
        groups = [{
          name: reqBody.query,
          type: "main",
          recommendation_reason: "",
          evidence: evidenceCandidates.slice(0, 12).map((i) => ({ ...i })),
        }];
      }
    }

    const latencyMs = Date.now() - startedAt;
    const responseData: SearchResponseData = {
      cache_hit: false,
      latency_ms: latencyMs,
      connectors: { succeeded, failed },
      report,
      groups,
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

// Hydrate LLM-emitted groups (evidence as ids) into full ItemGroup objects.
// Looks each id up in the evidence pool, skips groups whose evidence has all
// been dropped, and sorts main groups before related ones.
function resolveGroups(
  llmGroups: Array<{
    name: string;
    type: "main" | "related";
    recommendation_reason: string;
    evidence_ids: string[];
  }>,
  evidence: RawItem[],
): ItemGroup[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const out: ItemGroup[] = [];
  for (const g of llmGroups) {
    const items: ReportItem[] = [];
    const seen = new Set<string>();
    for (const id of g.evidence_ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const e = byId.get(id);
      if (e) items.push({ ...e, recommendation_reason: g.recommendation_reason });
    }
    if (items.length === 0) continue;
    out.push({
      name: g.name,
      type: g.type,
      recommendation_reason: g.recommendation_reason,
      evidence: items.slice(0, 8),
    });
  }
  out.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "main" ? -1 : 1;
  });
  return out;
}

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
