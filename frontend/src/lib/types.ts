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
  items: ReportItem[];
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
