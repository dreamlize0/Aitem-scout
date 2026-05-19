// /functions/v1/saved-items — CRUD for items inside a project.
//
// GET    /saved-items?project_id=<uuid>
// POST   /saved-items            { project_id, items: [...] }
// DELETE /saved-items?id=<uuid>

import { corsPreflight, fail, handleUnknownError, ok } from "../_shared/response.ts";
import { AuthError, requireUser } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/supabase.ts";
import type { Citation, SavedItem, SourcePlatform } from "../_shared/types.ts";

const VALID_PLATFORMS: SourcePlatform[] = [
  "naver", "kakao", "youtube", "instagram", "x", "threads", "google_trends", "web",
];

interface IncomingItem {
  title: string;
  summary?: string;
  thumbnail_url?: string;
  source_url: string;
  source_platform?: string;
  recommendation_reason?: string;
  metadata?: Record<string, unknown>;
  citations?: Citation[];
}

interface SavedItemRow {
  id: string;
  project_id: string;
  title: string;
  summary: string | null;
  thumbnail_url: string | null;
  source_url: string;
  source_platform: SourcePlatform;
  recommendation_reason: string | null;
  metadata: Record<string, unknown>;
  position: number;
  created_at: string;
  source_citations: Citation[] | null;
}

function toDTO(row: SavedItemRow): SavedItem {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    summary: row.summary,
    thumbnail_url: row.thumbnail_url,
    source_url: row.source_url,
    source_platform: row.source_platform,
    recommendation_reason: row.recommendation_reason,
    metadata: row.metadata ?? {},
    position: row.position,
    citations: row.source_citations ?? [],
    created_at: row.created_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  try {
    await requireUser(req); // ensure JWT is present; RLS does the row-level check.
    const client = getUserClient(req);
    const url = new URL(req.url);

    if (req.method === "GET") {
      const projectId = url.searchParams.get("project_id");
      if (!projectId) return fail("VALIDATION_ERROR", "`project_id` required");
      const { data, error } = await client
        .from("saved_items")
        .select("id,project_id,title,summary,thumbnail_url,source_url,source_platform,recommendation_reason,metadata,position,created_at,source_citations(platform,url,excerpt)")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) return fail("INTERNAL", error.message);
      return ok({ items: (data as unknown as SavedItemRow[]).map(toDTO) });
    }

    if (req.method === "POST") {
      const body = await safeJson(req);
      const projectId = body?.project_id as string | undefined;
      const items = body?.items as IncomingItem[] | undefined;
      if (!projectId || !Array.isArray(items) || items.length === 0) {
        return fail("VALIDATION_ERROR", "`project_id` and non-empty `items[]` required");
      }
      // Find current max position for stable ordering.
      const headResp = await client
        .from("saved_items")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const startPos = (headResp.data?.position ?? -1) + 1;

      const rows = items.map((it, idx) => ({
        project_id: projectId,
        title: it.title,
        summary: it.summary ?? null,
        thumbnail_url: it.thumbnail_url ?? null,
        source_url: it.source_url,
        source_platform: normalizePlatform(it.source_platform),
        recommendation_reason: it.recommendation_reason ?? null,
        metadata: it.metadata ?? {},
        position: startPos + idx,
      }));

      const inserted = await client
        .from("saved_items")
        .insert(rows)
        .select("id,project_id,title,summary,thumbnail_url,source_url,source_platform,recommendation_reason,metadata,position,created_at");
      if (inserted.error) return fail("INTERNAL", inserted.error.message);

      // Insert citations for items that brought them along.
      const citationRows: Array<{ saved_item_id: string; platform: SourcePlatform; url: string; excerpt: string | null }> = [];
      inserted.data!.forEach((row, idx) => {
        const cits = items[idx].citations ?? [];
        for (const c of cits) {
          if (!c.url) continue;
          citationRows.push({
            saved_item_id: row.id,
            platform: normalizePlatform(c.platform),
            url: c.url,
            excerpt: c.excerpt ?? null,
          });
        }
      });
      if (citationRows.length > 0) {
        const citResp = await client.from("source_citations").insert(citationRows);
        if (citResp.error) console.error("[saved-items] citation insert failed", citResp.error);
      }

      // Re-fetch with citations joined for the response.
      const ids = inserted.data!.map((r) => r.id);
      const finalResp = await client
        .from("saved_items")
        .select("id,project_id,title,summary,thumbnail_url,source_url,source_platform,recommendation_reason,metadata,position,created_at,source_citations(platform,url,excerpt)")
        .in("id", ids)
        .order("position", { ascending: true });
      if (finalResp.error) return fail("INTERNAL", finalResp.error.message);
      return ok({ items: (finalResp.data as unknown as SavedItemRow[]).map(toDTO) }, { status: 201 });
    }

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return fail("VALIDATION_ERROR", "`id` query param required");
      const { error } = await client.from("saved_items").delete().eq("id", id);
      if (error) return fail("INTERNAL", error.message);
      return ok({ deleted_id: id });
    }

    return fail("VALIDATION_ERROR", `Method ${req.method} not allowed`, { status: 405 });
  } catch (err) {
    if (err instanceof AuthError) return fail("UNAUTHORIZED", err.message);
    return handleUnknownError(err);
  }
});

function normalizePlatform(p: string | undefined): SourcePlatform {
  if (p && (VALID_PLATFORMS as string[]).includes(p)) return p as SourcePlatform;
  return "web";
}

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
