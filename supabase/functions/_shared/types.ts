// Shared types across edge functions. Mirrors `supabase/docs/api-spec.md`.

export type SourcePlatform =
  | "naver"
  | "kakao"
  | "youtube"
  | "instagram"
  | "x"
  | "threads"
  | "google_trends"
  | "web";

export interface SearchTarget {
  gender?: "male" | "female" | "any";
  age_range?: "10-20" | "20-30" | "30-40" | "40-50" | "50+" | "any";
  lifestyle?: string;
}

export interface SearchFilters {
  theme?: string[];
  target?: SearchTarget;
  locale?: string;             // 'ko-KR'
  global_targets?: string[];   // ISO-3166 alpha-2
}

export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  force_refresh?: boolean;
}

export interface Citation {
  platform: SourcePlatform;
  url: string;
  excerpt?: string;
}

export interface RawItem {
  id: string;                   // connector-scoped temp id
  title: string;
  summary?: string;
  thumbnail_url?: string;
  source_url: string;
  source_platform: SourcePlatform;
  metadata?: Record<string, unknown>;
  citations?: Citation[];
}

export interface ReportItem extends RawItem {
  recommendation_reason?: string;
}

// An LLM-curated grouping of evidence around a single shoot-able item.
// `name` is what the user sees (e.g. "남대문 화장품"); `type` distinguishes
// the user's primary search subject from LLM-discovered related subjects so
// the UI can offer a "search again on this related item" affordance.
export interface ItemGroup {
  name: string;
  type: "main" | "related";
  recommendation_reason: string;
  // 0-100. LLM-rated for THIS group specifically, based on evidence metrics
  // (likes/views/timestamps), platform diversity, and target fit. Sibling
  // groups should have distinct scores so the UI can rank/highlight.
  trend_score: number;
  evidence: ReportItem[];
}

export interface SearchReport {
  summary: string;
  trend_score: number;
  global_trend_chart?: Array<{ label: string; value: number }>;
  top_themes?: string[];
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

export interface SavedItem {
  id: string;
  project_id: string;
  title: string;
  summary?: string | null;
  thumbnail_url?: string | null;
  source_url: string;
  source_platform: SourcePlatform;
  recommendation_reason?: string | null;
  metadata: Record<string, unknown>;
  position: number;
  citations: Citation[];
  created_at: string;
}

export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  share_enabled: boolean;
  share_token: string | null;
  share_url: string | null;
  saved_items_count: number;
  created_at: string;
  updated_at: string;
}

// Cold-contact (PRD nice-to-have): generate an outreach draft for a chosen
// item. We expose three kinds covering the most common pitches.
export type ColdContactKind = "email" | "dm" | "proposal";

export interface ColdContactItemInput {
  title: string;
  summary?: string;
  source_url: string;
  source_platform: SourcePlatform | string;
  metadata?: Record<string, unknown>;
}

export interface ColdContactRequest {
  kind: ColdContactKind;
  item: ColdContactItemInput;
  // Optional context — reuses the search-side target shape so the caller can
  // pass the same filter they searched with.
  target_audience?: SearchTarget;
  // Free-form note from the creator (e.g. "주말 야간 촬영 가능 여부 확인하고 싶음").
  creator_note?: string;
}

export interface ColdContactResponseData {
  kind: ColdContactKind;
  draft: string;
}
