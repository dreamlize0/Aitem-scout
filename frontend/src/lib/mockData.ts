// Local-only fallback that mirrors the SearchResponseData shape. Used when
// NEXT_PUBLIC_SUPABASE_* env vars are not set so the UI can be demoed without
// the backend running. Real responses come from src/lib/api.ts → /search.

import type { SearchResponseData } from "./types";

export const MOCK_SEARCH_RESPONSE: SearchResponseData = {
  cache_hit: false,
  latency_ms: 2987,
  connectors: {
    succeeded: ["naver", "youtube", "google_trends"],
    failed: [{ name: "meta", code: "RATE_LIMITED", message: "Mock mode" }],
  },
  report: {
    summary:
      "성수동 팝업·외국인 로컬 맛집·가성비 효도 호캉스 키워드가 동반 상승 중입니다. 30-40대 여성과 외국인 관광객 타겟에서 시각적 임팩트가 강한 포맷이 우세합니다.",
    trend_score: 84,
    trend_insight: "지금 30-40대 여성은 성수동 팝업·외국인이 줄 서는 로컬 맛집을 가장 많이 검색하고 있어요. 최근 4주 동안 관련 키워드 검색량이 2.5배로 늘었습니다.",
    top_themes: ["가성비 데이트", "외국인 반응", "효도 호캉스", "팝업 인생샷"],
    global_trend_chart: [
      { label: "2026-01", value: 35 },
      { label: "2026-02", value: 42 },
      { label: "2026-03", value: 58 },
      { label: "2026-04", value: 71 },
      { label: "2026-05", value: 88 },
    ],
  },
  groups: [
    {
      name: "성수동 팝업스토어",
      type: "main",
      trend_score: 88,
      business_query: "성수동 팝업스토어",
      recommendation_reason:
        "최근 인스타그램 릴스와 스레드에서 '성수동 팝업' 언급량이 전주 대비 300% 상승했습니다. 30-40대 여성 타겟에게 시각 임팩트가 강해 쇼츠/릴스 소재로 적합합니다.",
      evidence: [
        {
          id: "mock-ig-1",
          title: "성수동 이색 팝업스토어",
          summary: "2030 여성이 열광하는 감각적인 브랜드 체험 공간",
          source_url: "https://instagram.com/explore/tags/성수팝업",
          source_platform: "instagram",
          citations: [{ platform: "instagram", url: "https://instagram.com/explore/tags/성수팝업" }],
          metadata: { mentions_7d: 1840 },
        },
        {
          id: "mock-yt-1",
          title: "성수동 팝업스토어 VLOG",
          source_url: "https://youtube.com/results?search_query=성수동+팝업스토어",
          source_platform: "youtube",
          citations: [
            { platform: "youtube", url: "https://youtube.com/results?search_query=성수동+팝업스토어" },
          ],
          metadata: {},
        },
      ],
    },
    {
      name: "외국인 K-로컬 맛집",
      type: "related",
      trend_score: 72,
      business_query: "K-로컬 맛집",
      recommendation_reason:
        "일본 검색 트렌드에서 '한국 로컬 맛집' 검색량이 꾸준히 증가 중입니다. 일본인 관광객 타겟에게 투박한 아재 감성이 신선한 반응을 얻고 있습니다.",
      evidence: [
        {
          id: "mock-x-1",
          title: "외국인이 환장하는 K-로컬 국밥집",
          summary: "관광 가이드북에 없는, 찐 한국인들만 아는 로컬 맛집",
          source_url: "https://x.com/search?q=韓国ローカルグルメ",
          source_platform: "x",
          citations: [
            { platform: "x", url: "https://x.com/search?q=韓国ローカルグルメ" },
            { platform: "naver", url: "https://search.naver.com/search.naver?query=외국인+국밥+반응" },
          ],
          metadata: { search_growth_jp: 1.42 },
        },
      ],
    },
    {
      name: "가성비 효도 호캉스",
      type: "related",
      trend_score: 65,
      business_query: "호텔",
      recommendation_reason:
        "5월 가정의 달을 앞두고 '효도여행' 키워드가 급상승 중입니다. 가성비를 강조하면서 고급스러움을 연출하는 포맷이 유튜브 평균 시청 지속 시간에서 우세합니다.",
      evidence: [
        {
          id: "mock-yt-2",
          title: "가성비 갑 50대 부모님 효도 호캉스",
          summary: "10만원대에 누리는 5성급 호텔 부럽지 않은 프리미엄 서비스",
          source_url: "https://youtube.com/results?search_query=가성비+효도+호캉스",
          source_platform: "youtube",
          citations: [
            { platform: "youtube", url: "https://youtube.com/results?search_query=가성비+효도+호캉스" },
            { platform: "naver", url: "https://search.naver.com/search.naver?query=부모님+호캉스+추천" },
          ],
          metadata: { trend_score: 78 },
        },
      ],
    },
  ],
};

export function fetchMockSearch(_query: string): Promise<SearchResponseData> {
  // Simulate 3s skeleton wait for parity with real LLM latency.
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_SEARCH_RESPONSE), 3000));
}
