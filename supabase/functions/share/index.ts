// /functions/v1/share — public read-only viewer for a shared project.
// verify_jwt = false (see config.toml). Uses service-role client to bypass RLS
// after the share token has been validated and share_enabled is true.

import { corsPreflight, fail, handleUnknownError, ok } from "../_shared/response.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import type { SavedItem } from "../_shared/types.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "GET" && req.method !== "POST") {
    return fail("VALIDATION_ERROR", `Method ${req.method} not allowed`, { status: 405 });
  }

  try {
    const token = await extractToken(req);
    if (!token) return fail("VALIDATION_ERROR", "Missing share token");

    const supabase = getServiceClient();

    const projectResp = await supabase
      .from("projects")
      .select("id,name,description,owner_id,share_enabled,created_at,updated_at")
      .eq("share_token", token)
      .maybeSingle();

    if (projectResp.error) return fail("INTERNAL", projectResp.error.message);
    if (!projectResp.data || !projectResp.data.share_enabled) {
      return fail("NOT_FOUND", "Share link not found or disabled");
    }

    const project = projectResp.data;

    const [ownerResp, itemsResp] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", project.owner_id).maybeSingle(),
      supabase
        .from("saved_items")
        .select("id,project_id,title,summary,thumbnail_url,source_url,source_platform,recommendation_reason,metadata,position,created_at,source_citations(platform,url,excerpt)")
        .eq("project_id", project.id)
        .order("position", { ascending: true }),
    ]);

    if (itemsResp.error) return fail("INTERNAL", itemsResp.error.message);

    const items: SavedItem[] = (itemsResp.data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      project_id: row.project_id as string,
      title: row.title as string,
      summary: (row.summary as string | null) ?? null,
      thumbnail_url: (row.thumbnail_url as string | null) ?? null,
      source_url: row.source_url as string,
      source_platform: row.source_platform as SavedItem["source_platform"],
      recommendation_reason: (row.recommendation_reason as string | null) ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      position: row.position as number,
      citations: (row.source_citations as SavedItem["citations"]) ?? [],
      created_at: row.created_at as string,
    }));

    return ok({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        owner_display_name: ownerResp.data?.display_name ?? null,
        generated_at: new Date().toISOString(),
      },
      items,
    });
  } catch (err) {
    return handleUnknownError(err);
  }
});

async function extractToken(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const qp = url.searchParams.get("token");
  if (qp) return qp;
  // Path-based: /functions/v1/share/<token>
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && last !== "share") return last;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.token === "string") return body.token;
    } catch { /* ignore */ }
  }
  return null;
}
