// /functions/v1/cold-contact — generate an outreach draft for a chosen item.
// PRD nice-to-have: AI 콜드 컨택 템플릿 지원.
//
// POST /cold-contact
//   body: { kind: "email"|"dm"|"proposal", item: {...}, target_audience?, creator_note? }
//   returns: { kind, draft }

import { corsPreflight, fail, handleUnknownError, ok } from "../_shared/response.ts";
import { AuthError, requireUser } from "../_shared/auth.ts";
import { generateColdContact, LlmError } from "../_shared/llm/claude.ts";
import type {
  ColdContactItemInput,
  ColdContactKind,
  ColdContactRequest,
  ColdContactResponseData,
  SearchTarget,
} from "../_shared/types.ts";

const VALID_KINDS: ColdContactKind[] = ["email", "dm", "proposal"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return fail("VALIDATION_ERROR", `Method ${req.method} not allowed`, { status: 405 });
  }

  try {
    try {
      await requireUser(req);
    } catch (err) {
      if (err instanceof AuthError) return fail("UNAUTHORIZED", err.message);
      throw err;
    }

    const body = await safeJson(req);
    if (!body) return fail("VALIDATION_ERROR", "Invalid JSON body");

    const kind = body["kind"];
    if (typeof kind !== "string" || !VALID_KINDS.includes(kind as ColdContactKind)) {
      return fail("VALIDATION_ERROR", "kind must be one of email|dm|proposal");
    }

    const rawItem = body["item"];
    const item = parseItem(rawItem);
    if (!item) {
      return fail(
        "VALIDATION_ERROR",
        "item.title and item.source_url are required strings",
      );
    }

    const reqBody: ColdContactRequest = {
      kind: kind as ColdContactKind,
      item,
      target_audience: parseTarget(body["target_audience"]),
      creator_note:
        typeof body["creator_note"] === "string" ? body["creator_note"].slice(0, 1000) : undefined,
    };

    try {
      const draft = await generateColdContact({
        kind: reqBody.kind,
        item: reqBody.item,
        target_audience: reqBody.target_audience,
        creator_note: reqBody.creator_note,
      });
      return ok<ColdContactResponseData>({ kind: reqBody.kind, draft });
    } catch (err) {
      if (err instanceof LlmError) return fail("LLM_FAILED", err.message);
      throw err;
    }
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

function parseItem(raw: unknown): ColdContactItemInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["title"] !== "string" || typeof r["source_url"] !== "string") return null;
  return {
    title: r["title"],
    summary: typeof r["summary"] === "string" ? r["summary"] : undefined,
    source_url: r["source_url"],
    source_platform: typeof r["source_platform"] === "string" ? r["source_platform"] : "web",
    metadata:
      r["metadata"] && typeof r["metadata"] === "object"
        ? (r["metadata"] as Record<string, unknown>)
        : undefined,
  };
}

function parseTarget(raw: unknown): SearchTarget | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  const out: SearchTarget = {};
  if (typeof t["gender"] === "string") out.gender = t["gender"] as SearchTarget["gender"];
  if (typeof t["age_range"] === "string") out.age_range = t["age_range"] as SearchTarget["age_range"];
  if (typeof t["lifestyle"] === "string") out.lifestyle = t["lifestyle"];
  return Object.keys(out).length === 0 ? undefined : out;
}
