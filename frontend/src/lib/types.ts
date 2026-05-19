// Shared types — mirrors supabase/docs/api-spec.md.
// If a field here drifts from the spec, the spec wins; treat this file as a
// derived view of the contract.

export type SourcePlatform =
  | "naver"
  | "kakao"
  | "youtube"
  | "instagram"
  | "x"
  | "threads"
  | "google_trends"
  | "web";

export interface Citation {
  platform: SourcePlatform;
  url: string;
  excerpt?: string;
}

export interface ReportItem {
  id: string;
  title: string;
  summary?: string;
  thumbnail_url?: string;
  source_url: string;
  source_platform: SourcePlatform;
  recommendation_reason?: string;
  citations: Citation[];
  metadata: Record<string, unknown>;
}

// LLM-curated grouping of evidence around a single shoot-able item. `name` is
// what the user sees on the card (e.g. "남대문 화장품"); `type` distinguishes
// the user's primary subject from LLM-discovered related subjects.
export interface ItemGroup {
  name: string;
  type: "main" | "related";
  recommendation_reason: string;
  // 0-100. LLM-rated for THIS group; sibling groups should have distinct
  // scores so the UI can highlight the strongest pick.
  trend_score: number;
  // Naver-Local-friendly search keyword for the businesses panel. Distinct
  // from `name` so content modifiers ("탐방"/"리뷰") don't break the lookup.
  business_query: string;
  evidence: ReportItem[];
}

// Real-world contactable place tied to a group name. Returned by the
// /businesses endpoint (Naver 지역검색 wrapper) so the detail panel can
// surface actual shops/restaurants/venues alongside the content evidence.
export interface Business {
  name: string;
  category: string;
  description: string;
  road_address: string;
  jibun_address: string;
  telephone: string;
  link: string;
  map_url: string;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface SearchReport {
  summary: string;
  trend_score: number;
  top_themes: string[];
  global_trend_chart?: TrendPoint[];
}

export interface ConnectorFailure {
  name: string;
  code: string;
  message?: string;
}

export interface SearchResponseData {
  cache_hit: boolean;
  latency_ms: number;
  connectors: {
    succeeded: string[];
    failed: ConnectorFailure[];
  };
  report: SearchReport;
  groups: ItemGroup[];
}

export interface SearchFilters {
  theme?: string[];
  target?: {
    gender?: "male" | "female" | "any";
    age_range?: "10-20" | "20-30" | "30-40" | "40-50" | "50+" | "any";
    lifestyle?: string;
  };
  locale?: string;
  global_targets?: string[];
}

export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  force_refresh?: boolean;
}

export interface SavedItem {
  id: string;
  project_id: string;
  title: string;
  summary?: string;
  thumbnail_url?: string;
  source_url: string;
  source_platform: SourcePlatform;
  recommendation_reason?: string;
  metadata: Record<string, unknown>;
  position: number;
  citations: Citation[];
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  share_enabled: boolean;
  share_token: string | null;
  // Absolute URL when backend SITE_URL is configured, otherwise relative
  // ("/share/<token>"); UI should join with window.location.origin as a fallback.
  share_url: string | null;
  saved_items_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectListData {
  items: Project[];
}

export interface ShareViewData {
  project: {
    id: string;
    name: string;
    description?: string;
    owner_display_name?: string;
    generated_at: string;
  };
  items: SavedItem[];
}

// Collapse a group into a single ReportItem for the detail panel. The group's
// name becomes the title (so save/share carry the curated label, not the
// raw evidence headline) and every evidence's source_url + citations are
// merged into one deduped citations list — so the panel's "데이터 출처" grid
// shows every platform the group is backed by.
export function groupToReportItem(group: ItemGroup): ReportItem {
  const primary = group.evidence[0];
  const citations: Citation[] = [];
  const seen = new Set<string>();
  for (const e of group.evidence) {
    for (const c of [
      { platform: e.source_platform, url: e.source_url, excerpt: e.summary?.slice(0, 200) },
      ...(e.citations ?? []),
    ]) {
      if (!c.url || seen.has(c.url)) continue;
      seen.add(c.url);
      citations.push(c);
    }
  }
  return {
    id: `group-${group.type}-${group.name}`,
    title: group.name,
    summary: primary?.summary,
    thumbnail_url: primary?.thumbnail_url,
    source_url: primary?.source_url ?? "",
    source_platform: primary?.source_platform ?? "web",
    recommendation_reason: group.recommendation_reason,
    citations,
    metadata: { group_type: group.type, evidence_count: group.evidence.length },
  };
}

export function savedItemToReportItem(s: SavedItem): ReportItem {
  return {
    id: s.id,
    title: s.title,
    summary: s.summary ?? undefined,
    thumbnail_url: s.thumbnail_url ?? undefined,
    source_url: s.source_url,
    source_platform: s.source_platform,
    recommendation_reason: s.recommendation_reason ?? undefined,
    citations: s.citations ?? [],
    metadata: s.metadata ?? {},
  };
}

// Cold-contact (PRD nice-to-have) — outreach draft generator.
export type ColdContactKind = "email" | "dm" | "proposal";

export interface ColdContactRequest {
  kind: ColdContactKind;
  item: {
    title: string;
    summary?: string;
    source_url: string;
    source_platform: SourcePlatform | string;
    metadata?: Record<string, unknown>;
  };
  target_audience?: SearchFilters["target"];
  creator_note?: string;
}

export interface ColdContactResponseData {
  kind: ColdContactKind;
  draft: string;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_FAILED"
  | "LLM_FAILED"
  | "INTERNAL";

export interface ApiError {
  code: ApiErrorCode | string;
  message: string;
}

export type ApiEnvelope<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: ApiError };
