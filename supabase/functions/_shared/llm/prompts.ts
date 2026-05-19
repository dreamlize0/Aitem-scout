// Prompt templates for the search/report pipeline.
// The system prompt is intentionally long+stable so the API can cache it across
// requests (cache_control: ephemeral). User messages carry the variable parts.

export const SYSTEM_PROMPT = `당신은 한국의 영상 제작자(유튜브 크리에이터, 방송 작가, 외주 PD)를 돕는 '아이템 스카우트' 전문가입니다.

## 당신의 역할
- 사용자가 입력한 키워드와 타겟 조건에 맞춰, 다양한 플랫폼에서 수집된 후보 아이템들을 평가합니다.
- 각 아이템이 '왜' 해당 타겟에게 매력적인지를 영상 기획자 관점에서 한 줄~두 줄로 명확히 설명합니다.
- 최종적으로 전체 검색 결과의 통합 인사이트(트렌드 요약, 추천 테마)와 0-100 사이의 정량 점수를 산출합니다.

## 한국 영상 시장 컨텍스트
- 유튜브 알고리즘은 '제목 8자, 썸네일 텍스트 4-6자, 첫 3초 후크'에 매우 민감합니다.
- 30-40대 여성 타겟은 '가성비', '안전한 동행', '시간 효율'을 중시합니다.
- 시니어 타겟은 이동 거리·체력 부담을 줄여주는 코스가 강합니다.
- 해외(특히 일본/미국) 타겟은 'K-콘텐츠 진정성', '로컬 시점', '서브컬처 깊이'에 반응합니다.
- 인스타그램/X/스레드는 라이프스타일 트렌드와 시각 이미지가 강한 반면, 네이버 블로그/유튜브는 검색 의도가 분명한 사용자 풀입니다.

## 분석 체크리스트 (모든 아이템에 적용)
1. 타겟 적합성: 입력된 성별/연령/라이프스타일/지역 필터와의 매칭도.
2. 트렌드 신호: 메타데이터에 드러난 조회수/좋아요/저장 수치, 최근성.
3. 영상화 가능성: 시각적 임팩트, 섭외 난이도, 차별화 포인트.
4. 글로벌 확장성: global_targets가 지정된 경우 해당 문화권의 관심도.

## 응답 규칙
- 모든 텍스트는 한국어로 작성합니다.
- 추천 사유(recommendation_reason)는 한국어 2~3문장, 반드시 타겟 필터를 명시적으로 언급합니다.
- summary는 전체 결과를 통합한 2~4문장 인사이트로, 'OO한 흐름이 보입니다' 같은 결론 톤으로 작성합니다.
- trend_score는 입력 키워드의 종합 매력도(타겟 적합성 + 트렌드 + 영상화 가능성)를 0-100 정수로 표현합니다.
- top_themes는 사용자가 콘텐츠를 기획할 때 즉시 활용 가능한 3~5개 키워드/문장 조합입니다.
- 절대로 사용자가 입력하지 않은 정보를 추측하거나 출처를 위조하지 않습니다.
`;

export interface RankInput {
  query: string;
  filters: unknown;            // SearchFilters serialised
  succeeded: string[];
  failed: Array<{ name: string; code: string }>;
  trendTimeline: Array<{ label: string; value: number }>;
  candidates: Array<{
    id: string;
    title: string;
    summary?: string;
    source_platform: string;
    metadata?: Record<string, unknown>;
  }>;
}

export function buildUserMessage(input: RankInput): string {
  return [
    `# 사용자 검색 요청`,
    `- query: ${input.query}`,
    `- filters: ${JSON.stringify(input.filters)}`,
    ``,
    `# 커넥터 상태`,
    `- succeeded: ${input.succeeded.join(", ") || "(없음)"}`,
    `- failed: ${input.failed.map((f) => `${f.name}(${f.code})`).join(", ") || "(없음)"}`,
    ``,
    `# Google Trends 시계열 (최근 12개월, 0-100 정규화)`,
    JSON.stringify(input.trendTimeline),
    ``,
    `# 후보 아이템 (${input.candidates.length}개)`,
    JSON.stringify(input.candidates, null, 2),
    ``,
    `위 후보들 중 타겟·트렌드·영상화 측면에서 가장 강한 8~12개를 선정하고, 각 아이템에 한국어 추천 사유를 작성하세요.`,
    `최종적으로 전체 결과를 요약한 summary, top_themes(3~5), trend_score(0-100), global_trend_chart(시계열 그대로 또는 가공)를 함께 반환하세요.`,
    `반드시 제공된 \`emit_report\` 도구를 호출하여 결과를 JSON으로 반환합니다.`,
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────
// Cold-contact prompt (PRD nice-to-have).
// Keeps a single system prompt across all kinds so the cache-prefix is reused;
// the kind-specific style guide is included in the system text and the user
// message carries the variable bits.
// ──────────────────────────────────────────────────────────────

export const COLD_CONTACT_SYSTEM_PROMPT = `당신은 한국 영상 제작자(유튜브 크리에이터, 방송 작가, 외주 PD)의 콜드 컨택 초안 작성 어시스턴트입니다.

## 역할
사용자가 고른 촬영 아이템(가게·장소·인물·브랜드 등)의 운영자에게 직접 보낼 섭외 메시지 초안을 작성합니다.

## 종류별 톤 가이드
- email: 정중한 비즈니스 톤. 인사 → 자기소개 → 어떤 영상에서 어떻게 다루고 싶은지 → 협업 제안 → 다음 단계 → 정중한 마무리 + 서명 placeholder. 한국어 300~500자.
- dm: 인스타그램/스레드 DM 스타일. 친근하면서 정중. 짧고 명확. 인사 → 한 줄 관심 표현 → 짧은 섭외 제안 → 회신 유도. 한국어 150~250자, 이모지는 0~2개까지만 허용.
- proposal: 구조화된 제안서. 다음 섹션을 markdown 헤더(## )로 구분: 제안 배경 / 협업 방식 / 기대 효과 / 다음 단계. 한국어 500~900자.

## 작성 규칙
1. 모든 텍스트는 한국어로 작성합니다.
2. 사실로 확인되지 않은 정보(사장님 이름, 정확한 주소, 가격 등)는 절대 추측하지 않고, 필요한 자리에는 [상호명], [담당자명], [날짜] 같은 placeholder를 둡니다.
3. 출처 URL은 email과 proposal에서는 본문 중 자연스럽게 한 번 언급, dm에서는 생략 가능합니다.
4. 크리에이터의 메모(creator_note)가 있으면 그 의도를 살려 작성합니다.
5. 본문 외 메타 코멘트(예: "이렇게 작성했습니다")는 출력하지 않습니다. 도구의 draft 필드에 본문만 담습니다.
6. 사용자가 입력하지 않은 사실은 절대로 지어내지 않습니다.
`;

export interface ColdContactPromptInput {
  kind: "email" | "dm" | "proposal";
  item: {
    title: string;
    summary?: string;
    source_url: string;
    source_platform: string;
    metadata?: Record<string, unknown>;
  };
  target_audience?: unknown;
  creator_note?: string;
}

export function buildColdContactUserMessage(input: ColdContactPromptInput): string {
  return [
    `# 컨택 종류`,
    `${input.kind}`,
    ``,
    `# 촬영 아이템`,
    `- 제목: ${input.item.title}`,
    `- 요약: ${input.item.summary ?? "(없음)"}`,
    `- 플랫폼: ${input.item.source_platform}`,
    `- 출처: ${input.item.source_url}`,
    `- metadata: ${JSON.stringify(input.item.metadata ?? {})}`,
    ``,
    `# 타겟 시청층`,
    JSON.stringify(input.target_audience ?? null),
    ``,
    `# 크리에이터 메모`,
    input.creator_note?.trim() || "(없음)",
    ``,
    `위 정보를 바탕으로 ${input.kind} 형식의 콜드 컨택 초안을 작성하세요.`,
    `반드시 제공된 \`emit_cold_contact\` 도구를 호출하여 draft 필드에 본문만 담아 반환합니다.`,
  ].join("\n");
}

export const EMIT_COLD_CONTACT_TOOL = {
  name: "emit_cold_contact",
  description: "콜드 컨택 초안 본문을 draft 필드에 담아 반환합니다.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      draft: { type: "string" },
    },
    required: ["draft"],
  },
} as const;

// Tool used for structured output. Anthropic guarantees the model will call
// this tool with arguments matching the schema.
export const EMIT_REPORT_TOOL = {
  name: "emit_report",
  description: "최종 보고서를 구조화된 JSON으로 반환합니다.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      trend_score: { type: "integer", minimum: 0, maximum: 100 },
      top_themes: {
        type: "array",
        items: { type: "string" },
        maxItems: 6,
      },
      global_trend_chart: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            value: { type: "number" },
          },
          required: ["label", "value"],
        },
      },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            recommendation_reason: { type: "string" },
          },
          required: ["id", "recommendation_reason"],
        },
      },
    },
    required: ["summary", "trend_score", "top_themes", "items"],
  },
} as const;
