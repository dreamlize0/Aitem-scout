// /functions/v1/projects — CRUD for user-owned projects.
//
// GET    /projects             -> list current user's projects (RLS-enforced)
// GET    /projects?id=<uuid>   -> single project
// POST   /projects             -> create
// PATCH  /projects?id=<uuid>   -> partial update (incl. share toggle / token regen)
// DELETE /projects?id=<uuid>   -> delete

import { corsPreflight, fail, handleUnknownError, ok } from "../_shared/response.ts";
import { AuthError, requireUser } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { buildShareUrl } from "../_shared/env.ts";
import type { ProjectDTO } from "../_shared/types.ts";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  share_enabled: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  saved_items: Array<{ count: number }> | null;
}

function toDTO(row: ProjectRow): ProjectDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    share_enabled: row.share_enabled,
    share_token: row.share_token,
    share_url: row.share_token ? buildShareUrl(row.share_token) : null,
    saved_items_count: row.saved_items?.[0]?.count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function generateShareToken(): string {
  // 24-char base32-ish token from crypto.randomUUID().
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  try {
    const user = await requireUser(req);
    const client = getUserClient(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      if (id) {
        const { data, error } = await client
          .from("projects")
          .select("id,name,description,share_enabled,share_token,created_at,updated_at,saved_items(count)")
          .eq("id", id)
          .maybeSingle();
        if (error) return fail("INTERNAL", error.message);
        if (!data) return fail("NOT_FOUND", "Project not found");
        return ok(toDTO(data as unknown as ProjectRow));
      }
      const { data, error } = await client
        .from("projects")
        .select("id,name,description,share_enabled,share_token,created_at,updated_at,saved_items(count)")
        .order("updated_at", { ascending: false });
      if (error) return fail("INTERNAL", error.message);
      return ok({ items: (data as unknown as ProjectRow[]).map(toDTO) });
    }

    if (req.method === "POST") {
      const body = await safeJson(req);
      if (!body?.name || typeof body.name !== "string") {
        return fail("VALIDATION_ERROR", "`name` is required");
      }
      const insert = {
        owner_id: user.userId,
        name: body.name,
        description: body.description ?? null,
        share_enabled: body.share_enabled === true,
        share_token: body.share_enabled === true ? generateShareToken() : null,
      };
      const { data, error } = await client
        .from("projects")
        .insert(insert)
        .select("id,name,description,share_enabled,share_token,created_at,updated_at,saved_items(count)")
        .single();
      if (error) return fail("INTERNAL", error.message);
      return ok(toDTO(data as unknown as ProjectRow), { status: 201 });
    }

    if (req.method === "PATCH") {
      if (!id) return fail("VALIDATION_ERROR", "`id` query param required");
      const body = await safeJson(req);
      const patch: Record<string, unknown> = {};
      if (typeof body?.name === "string") patch.name = body.name;
      if (typeof body?.description === "string" || body?.description === null) {
        patch.description = body.description;
      }
      if (typeof body?.share_enabled === "boolean") {
        patch.share_enabled = body.share_enabled;
      }
      // Token logic: enable + (no token yet OR regenerate) -> issue new token.
      // Disable -> clear token.
      const currentResp = await client
        .from("projects")
        .select("share_enabled,share_token")
        .eq("id", id)
        .maybeSingle();
      if (currentResp.error) return fail("INTERNAL", currentResp.error.message);
      if (!currentResp.data) return fail("NOT_FOUND", "Project not found");

      const nextEnabled = patch.share_enabled ?? currentResp.data.share_enabled;
      if (body?.regenerate_share_token === true && nextEnabled) {
        patch.share_token = generateShareToken();
      } else if (nextEnabled && !currentResp.data.share_token) {
        patch.share_token = generateShareToken();
      } else if (nextEnabled === false) {
        patch.share_token = null;
      }

      if (Object.keys(patch).length === 0) {
        return fail("VALIDATION_ERROR", "No updatable fields supplied");
      }

      const { data, error } = await client
        .from("projects")
        .update(patch)
        .eq("id", id)
        .select("id,name,description,share_enabled,share_token,created_at,updated_at,saved_items(count)")
        .single();
      if (error) return fail("INTERNAL", error.message);
      return ok(toDTO(data as unknown as ProjectRow));
    }

    if (req.method === "DELETE") {
      if (!id) return fail("VALIDATION_ERROR", "`id` query param required");
      const { error } = await client.from("projects").delete().eq("id", id);
      if (error) return fail("INTERNAL", error.message);
      return ok({ deleted_id: id });
    }

    return fail("VALIDATION_ERROR", `Method ${req.method} not allowed`, { status: 405 });
  } catch (err) {
    if (err instanceof AuthError) return fail("UNAUTHORIZED", err.message);
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
