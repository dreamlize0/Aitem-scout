// Thin typed wrappers over the Supabase edge functions.
// All backend responses use the { status, data | error } envelope — we unwrap
// it here so calling code can deal with plain payloads and a single ApiError
// exception class.

import { getSupabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase";
import { notifyProjectsChanged } from "./projectsEvents";
import type {
  ApiEnvelope,
  ApiError,
  ColdContactRequest,
  ColdContactResponseData,
  Project,
  ProjectListData,
  ReportItem,
  SavedItem,
  SearchRequest,
  SearchResponseData,
  ShareViewData,
} from "./types";

export class ApiClientError extends Error {
  readonly code: string;
  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
  }
}

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (envelope?.status === "success") return envelope.data;
  if (envelope?.status === "error") throw new ApiClientError(envelope.error);
  throw new ApiClientError({ code: "INTERNAL", message: "Malformed API response" });
}

export { isSupabaseConfigured };

export async function searchAItems(req: SearchRequest): Promise<SearchResponseData> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<SearchResponseData>>(
    "search",
    { body: req },
  );

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "검색 호출에 실패했습니다.",
    });
  }
  if (!data) {
    throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  }
  return unwrap(data);
}

export async function fetchProject(id: string): Promise<Project> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<Project>>(
    `projects?id=${encodeURIComponent(id)}`,
    { method: "GET" },
  );

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "프로젝트 정보 조회에 실패했습니다.",
    });
  }
  if (!data) throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  return unwrap(data);
}

export async function fetchSavedItems(projectId: string): Promise<SavedItem[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<{ items: SavedItem[] }>>(
    `saved-items?project_id=${encodeURIComponent(projectId)}`,
    { method: "GET" },
  );

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "저장된 아이템 조회에 실패했습니다.",
    });
  }
  if (!data) throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  return unwrap(data).items;
}

export async function deleteSavedItem(id: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<{ deleted_id: string }>>(
    `saved-items?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "아이템 삭제에 실패했습니다.",
    });
  }
  if (!data) throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  return unwrap(data).deleted_id;
}

export async function fetchProjects(): Promise<Project[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<ProjectListData>>(
    "projects",
    { method: "GET" },
  );

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "프로젝트 목록 호출에 실패했습니다.",
    });
  }
  if (!data) throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  return unwrap(data).items;
}

export async function updateProject(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    share_enabled?: boolean;
    regenerate_share_token?: boolean;
  },
): Promise<Project> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<Project>>(
    `projects?id=${encodeURIComponent(id)}`,
    { method: "PATCH", body: patch },
  );

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "프로젝트 갱신에 실패했습니다.",
    });
  }
  if (!data) throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  const project = unwrap(data);
  notifyProjectsChanged();
  return project;
}

export async function deleteProject(id: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<{ deleted_id: string }>>(
    `projects?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "프로젝트 삭제에 실패했습니다.",
    });
  }
  if (!data) throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  const deletedId = unwrap(data).deleted_id;
  notifyProjectsChanged();
  return deletedId;
}

export async function createProject(input: {
  name: string;
  description?: string;
  share_enabled?: boolean;
}): Promise<Project> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<Project>>("projects", {
    method: "POST",
    body: input,
  });

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "프로젝트 생성에 실패했습니다.",
    });
  }
  if (!data) throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  const project = unwrap(data);
  notifyProjectsChanged();
  return project;
}

// Strips the temporary ReportItem.id (search-time id) — the backend issues a
// new uuid for the persisted SavedItem.
function itemToSavePayload(item: ReportItem) {
  return {
    title: item.title,
    summary: item.summary,
    thumbnail_url: item.thumbnail_url,
    source_url: item.source_url,
    source_platform: item.source_platform,
    recommendation_reason: item.recommendation_reason,
    metadata: item.metadata,
    citations: item.citations,
  };
}

export async function saveItems(
  projectId: string,
  items: ReportItem[],
): Promise<SavedItem[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<{ items: SavedItem[] }>>(
    "saved-items",
    {
      method: "POST",
      body: { project_id: projectId, items: items.map(itemToSavePayload) },
    },
  );

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "보관함 저장에 실패했습니다.",
    });
  }
  if (!data) throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  const savedItems = unwrap(data).items;
  notifyProjectsChanged();
  return savedItems;
}

export async function generateColdContact(
  req: ColdContactRequest,
): Promise<ColdContactResponseData> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase 환경변수가 설정되지 않았습니다 (.env.local 확인).",
    });
  }

  const { data, error } = await supabase.functions.invoke<ApiEnvelope<ColdContactResponseData>>(
    "cold-contact",
    { body: req },
  );

  if (error) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: error.message || "콜드 컨택 초안 생성에 실패했습니다.",
    });
  }
  if (!data) throw new ApiClientError({ code: "INTERNAL", message: "응답이 비어 있습니다." });
  return unwrap(data);
}

// /share is publicly accessible (verify_jwt=false). We call it via fetch so we
// don't even need an anon key beyond the URL — but we still send the anon key
// when configured to satisfy the platform's gateway.
export async function fetchShared(token: string): Promise<ShareViewData> {
  if (!token) {
    throw new ApiClientError({ code: "VALIDATION_ERROR", message: "토큰이 비어 있습니다." });
  }
  if (!SUPABASE_URL) {
    throw new ApiClientError({
      code: "INTERNAL",
      message: "Supabase URL이 설정되지 않았습니다 (.env.local).",
    });
  }

  const url = `${SUPABASE_URL}/functions/v1/share?token=${encodeURIComponent(token)}`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (SUPABASE_ANON_KEY) {
    headers["apikey"] = SUPABASE_ANON_KEY;
    headers["authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(url, { headers, cache: "no-store" });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<ShareViewData> | null;
  if (!json) {
    throw new ApiClientError({ code: "INTERNAL", message: `share ${res.status}` });
  }
  return unwrap(json);
}
