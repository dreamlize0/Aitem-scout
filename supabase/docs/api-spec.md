# API Spec — AItem Scout

본 문서는 **프론트엔드(Antigravity) ↔ 백엔드(Claude)** 간 Contract First 합의서입니다.
모든 응답은 동일한 envelope을 사용합니다.

```jsonc
// 성공
{ "status": "success", "data": { ... } }

// 실패
{ "status": "error", "error": { "code": "ERROR_CODE", "message": "사용자 표시용 메시지" } }
```

## 공통

- Base URL (로컬): `http://127.0.0.1:54321/functions/v1`
- Base URL (배포): `https://<project-ref>.functions.supabase.co`
- 인증: `Authorization: Bearer <jwt-or-anon-key>` (share 엔드포인트만 anon 허용)
- 모든 POST/PATCH body는 `Content-Type: application/json`

### 표준 에러 코드

| code | HTTP | 의미 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 요청 페이로드 불량 |
| `UNAUTHORIZED` | 401 | JWT 미존재/만료 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `RATE_LIMITED` | 429 | 외부 API rate limit |
| `UPSTREAM_FAILED` | 502 | 외부 API 응답 실패 |
| `LLM_FAILED` | 502 | LLM 응답 실패 |
| `INTERNAL` | 500 | 그 외 서버 오류 |

---

## 1. `POST /search`

검색 키워드 + 필터 → 다중 커넥터 호출 + LLM 리포트.

### Request

```jsonc
{
  "query": "한강 데이트",                    // required, string
  "filters": {                              // optional, 전체 객체 또는 일부 가능
    "theme": ["가성비", "엄마랑 데이트"],     // string[]
    "target": {
      "gender": "female",                   // 'male' | 'female' | 'any'
      "age_range": "30-40",                 // '10-20' | '20-30' | '30-40' | '40-50' | '50+' | 'any'
      "lifestyle": "city"                   // 자유 문자열 (city, outdoor, family, premium, budget 등)
    },
    "locale": "ko-KR",                      // default 'ko-KR'
    "global_targets": ["JP", "US"]          // ISO 2자리 국가코드 배열
  },
  "force_refresh": false                    // true면 캐시 무시
}
```

### Response (`data`)

```jsonc
{
  "cache_hit": false,
  "latency_ms": 3812,
  "connectors": {
    "succeeded": ["naver", "youtube", "google_trends"],
    "failed": [
      { "name": "meta", "code": "RATE_LIMITED", "message": "Meta hashtag API rate limited" }
    ]
  },
  "report": {
    "summary": "...AI가 작성한 통합 인사이트...",
    "trend_score": 87,                      // 0-100
    "global_trend_chart": [
      { "label": "2026-04", "value": 62 },
      { "label": "2026-05", "value": 81 }
    ],
    "top_themes": ["가성비 데이트", "야경 명소"]
  },
  "items": [
    {
      "id": "naver-1737xxxx",                // 임시 id (저장 시 신규 uuid 할당)
      "title": "...",
      "summary": "...",
      "thumbnail_url": "...",
      "source_url": "https://...",
      "source_platform": "naver",            // enum: naver|kakao|youtube|instagram|x|threads|google_trends|web
      "recommendation_reason": "30-40대 여성에게 어필되는 ...",
      "citations": [
        { "platform": "naver", "url": "https://blog.naver.com/...", "excerpt": "..." }
      ],
      "metadata": { "naver_rank": 2, "views_7d": 12000 }
    }
  ]
}
```

부분 성공 시에도 `status: "success"`로 반환하고, `connectors.failed` 배열로 누락된 소스를 알립니다(Graceful Degradation).

---

## 2. `GET|POST|PATCH|DELETE /projects`

### Project 객체 (공통)
```jsonc
{
  "id": "uuid",
  "name": "골프 채널 기획",
  "description": "...",         // string | null
  "share_enabled": true,
  "share_token": "demo-share-golf-202605",  // string | null (share_enabled가 false면 null)
  "share_url": "https://app.example.com/share/demo-share-golf-202605", // 절대 URL (백엔드 SITE_URL env 사용), share_token이 없으면 null
  "saved_items_count": 12,
  "created_at": "2026-05-19T...",
  "updated_at": "2026-05-19T..."
}
```

### `GET /projects` (목록)
응답 `data`: `{ "items": Project[] }`. `updated_at` desc 정렬.

### `GET /projects?id=<uuid>` (단일)
응답 `data`: Project 객체 직접 (래핑 없음).

### `POST /projects` (생성)
Request:
```jsonc
{ "name": "string (required)", "description": "string (optional)", "share_enabled": false }
```
응답 `data`: 생성된 Project 객체 직접 (래핑 없음). HTTP 201.

### `PATCH /projects?id=<uuid>` (부분 갱신)
Request:
```jsonc
{ "name": "...", "description": "...", "share_enabled": true /*, "regenerate_share_token": true */ }
```
- `share_enabled: true`이고 토큰이 없으면 자동 발급.
- `regenerate_share_token: true`면 기존 토큰 폐기 후 재발급.
- `description`에 `null`을 보내면 삭제, 미전달 시 기존 값 유지.

응답 `data`: 갱신된 Project 객체 직접 (래핑 없음).

### `DELETE /projects?id=<uuid>`
응답 `data`: `{ "deleted_id": "uuid" }`.

---

## 3. `GET|POST|DELETE /saved-items`

### `GET /saved-items?project_id=<uuid>`
Response `data`: `{ "items": SavedItem[] }`

### `POST /saved-items`
Request:
```jsonc
{
  "project_id": "uuid",
  "items": [
    {
      "title": "string",
      "summary": "string",
      "thumbnail_url": "string",
      "source_url": "string (required)",
      "source_platform": "naver",
      "recommendation_reason": "string",
      "metadata": { "...": "..." },
      "citations": [{ "platform": "naver", "url": "...", "excerpt": "..." }]
    }
  ]
}
```
복수 저장 일괄 처리. Response `data`: `{ "items": SavedItem[] }`.

### `DELETE /saved-items?id=<uuid>`
Response `data`: `{ "deleted_id": "uuid" }`.

---

## 4. `GET /share/:token` (anon 가능)

비로그인 공개 뷰어. `verify_jwt = false`로 anon 키만 있어도 호출 가능합니다.

### Request
URL path 또는 쿼리: `GET /share?token=<token>`.

### Response `data`
```jsonc
{
  "project": {
    "id": "uuid",
    "name": "골프 채널 기획",
    "description": "...",
    "owner_display_name": "Demo Creator",
    "generated_at": "2026-05-19T12:34:56Z"
  },
  "items": [ /* SavedItem with citations */ ]
}
```

토큰이 없거나 `share_enabled = false`이면 `NOT_FOUND` 반환.

---

## 5. `POST /cold-contact`

선택한 아이템에 대한 콜드 컨택 초안(섭외 메일/DM/제안서)을 LLM으로 생성합니다. PRD nice-to-have 항목.

인증 필요 (JWT). 캐시 없음 — 호출당 LLM 1회.

### Request

```jsonc
{
  "kind": "email" | "dm" | "proposal",
  "item": {
    "title": "성수동 ○○ 팝업",
    "summary": "...",                 // optional
    "source_url": "https://...",
    "source_platform": "instagram",   // SourcePlatform
    "metadata": { /* 자유 */ }        // optional
  },
  "target_audience": {                // optional, SearchFilters.target과 동일 형식
    "gender": "female",
    "age_range": "30-40",
    "lifestyle": "워킹맘"
  },
  "creator_note": "주말 야간 촬영 가능 여부 확인"   // optional, 최대 1000자
}
```

### Response `data`

```jsonc
{
  "kind": "email",
  "draft": "안녕하세요, [상호명] 담당자님...\n\n..."
}
```

### 톤 가이드 (system prompt에 내장)

- `email`: 정중한 비즈니스 톤, 300~500자, 서명 placeholder 포함
- `dm`: 친근하고 짧게, 150~250자, 이모지 0~2개
- `proposal`: markdown 헤더로 구조화, 500~900자

`LLM_FAILED` 응답 가능. 사실 확인 안 된 정보(상호명/담당자명 등)는 placeholder로 둡니다.

---

## 6. SavedItem 타입 (참고)

```ts
type SourcePlatform =
  | 'naver' | 'kakao' | 'youtube' | 'instagram'
  | 'x' | 'threads' | 'google_trends' | 'web';

interface Citation {
  platform: SourcePlatform;
  url: string;
  excerpt?: string;
}

interface SavedItem {
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
```

---

## 7. 프론트 통합 가이드

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const { data, error } = await supabase.functions.invoke('search', {
  body: { query: '한강 데이트', filters: {...}, force_refresh: false },
});

if (data?.status === 'success') {
  // data.data.items / data.data.report ...
}
```

share 엔드포인트는 `supabase.functions.invoke('share', { body: { token } })` 또는
`fetch(\`${SUPABASE_URL}/functions/v1/share?token=...\`)` 로 호출. 인증 헤더 없이도 동작합니다.

---

## 8. 변경 관리

- 본 문서가 깨질 만한 breaking change는 PR 본문에 `[API-BREAKING]` 태그로 표기.
- 새 필드 추가(optional)는 minor 갱신으로 본 문서만 업데이트.
