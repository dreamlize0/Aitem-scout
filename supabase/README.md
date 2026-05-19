# AItem Scout — Backend (`/supabase`)

본 디렉토리는 `architecture_plan.md`의 협업 가이드 §4.2에 따라 백엔드(Supabase) 코드만 담는 영역입니다. 프론트엔드는 `/frontend`를 사용합니다.

## 폴더 구조

```
supabase/
├── config.toml                # Supabase CLI 프로젝트 설정
├── .env.example               # Edge Function 런타임 환경변수 템플릿
├── migrations/                # SQL 마이그레이션 (순서대로 적용, prod 포함)
│   ├── 0001_init_schema.sql
│   └── 0002_rls_policies.sql
├── seed.sql                   # 로컬 dev 시드 (supabase db reset에서만 실행, prod 무관)
├── functions/
│   ├── deno.json              # Deno 런타임 설정 (import map, fmt)
│   ├── _shared/               # 엣지펑션 공용 모듈
│   │   ├── env.ts / response.ts / supabase.ts / auth.ts
│   │   ├── cache.ts / retry.ts / orchestrator.ts / types.ts
│   │   ├── connectors/{base,index,naver,youtube,google-trends,meta,x,threads,kakao,tavily}.ts
│   │   └── llm/{claude,prompts}.ts
│   ├── search/index.ts        # POST /search (메인 파이프라인)
│   ├── projects/index.ts      # GET/POST/PATCH/DELETE /projects
│   ├── saved-items/index.ts   # GET/POST/DELETE /saved-items
│   ├── cold-contact/index.ts  # POST /cold-contact (콜드 컨택 초안 생성)
│   └── share/index.ts         # GET /share/:token (비로그인 공개)
└── docs/
    ├── api-spec.md            # 프론트와의 Contract First 합의서
    └── schema.md              # 테이블/관계/RLS 설명
```

## 빠른 시작

1. Supabase CLI 설치 (macOS: `brew install supabase/tap/supabase`).
2. 기존 원격 프로젝트에 연결: `cd supabase && supabase link --project-ref <project-ref>`.
3. 환경변수 설정: `.env.example`을 복사해 `.env` 작성 → `supabase secrets set --env-file .env`.
4. 마이그레이션 적용:
   - 로컬: `supabase db reset` (로컬 stack 띄우고 모든 마이그레이션 + 시드 실행).
   - 원격: `supabase db push`.
5. 엣지펑션 로컬 실행: `supabase functions serve search --env-file .env`.
6. 배포: `supabase functions deploy search projects saved-items share cold-contact`.

## 환경변수

`.env.example` 참조. 핵심:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (배포 시 자동 주입)
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-sonnet-4-6`
- `SEARCH_CACHE_TTL_SECONDS` (기본 86400, 24h)
- 커넥터별: `NAVER_CLIENT_ID/SECRET`, `YOUTUBE_API_KEY`, `SERPAPI_KEY`(옵션), `META_ACCESS_TOKEN/META_IG_BUSINESS_ID`, `X_BEARER_TOKEN`, `THREADS_ACCESS_TOKEN`

키가 누락된 커넥터는 비활성화 상태로 건너뜁니다 — 다른 커넥터는 정상 동작 (Graceful Degradation).

## 핵심 설계 결정

- **Contract First**: `docs/api-spec.md`가 프론트엔드와의 단일 진실 공급원. 변경 시 PR 본문에 `[API-BREAKING]` 표기.
- **모듈형 커넥터**: `_shared/connectors/`의 각 파일은 `SourceConnector` 인터페이스만 따르면 즉시 등록 가능. `connectors/index.ts`의 `ALL_CONNECTORS` 배열에만 추가하면 오케스트레이터가 자동으로 픽업합니다.
- **부분 성공**: 일부 커넥터가 실패해도 전체 검색은 성공합니다. 응답의 `connectors.failed`로 사용자에게 알릴 수 있도록 노출.
- **캐싱**: 동일 쿼리(정규화) 24h 캐시. `force_refresh: true`로 무시 가능. 캐시 적중 시 LLM 호출도 스킵.
- **RLS + service role 분리**: 사용자 데이터(projects/saved_items)는 RLS로 보호, 캐시/로그/공유 조회는 service role로 우회.
- **LLM 비용**: Claude Sonnet 4.6의 system prompt에 `cache_control: ephemeral`을 적용해 prefix를 재사용합니다. 운영 로그에서 `cache_read_input_tokens`로 효과 확인 가능.

## 검증 (Verification)

```bash
# 1) 로컬 스택 띄우기
supabase start
supabase db reset                       # 마이그레이션 + 시드

# 2) 마이그레이션 검증
psql "$DATABASE_URL" -c "\dt public.*"
psql "$DATABASE_URL" -c "select * from pg_policies where schemaname='public';"

# 3) 엣지펑션 실행
supabase functions serve --env-file .env

# 4) projects CRUD (anon 키 또는 사용자 JWT 필요)
curl -s -X POST http://127.0.0.1:54321/functions/v1/projects \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
  -d '{"name":"테스트 프로젝트"}' | jq

# 5) search 호출 (캐시 1차 미스 → 2차 적중 확인)
curl -s -X POST http://127.0.0.1:54321/functions/v1/search \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
  -d '{"query":"한강 데이트","filters":{"target":{"gender":"female","age_range":"30-40"}}}' | jq '.data.cache_hit,.data.connectors'

# 6) share — 비로그인 공개
curl -s "http://127.0.0.1:54321/functions/v1/share?token=demo-share-golf-202605" | jq
```

## 프론트엔드 동기화 체크리스트

- [x] `docs/api-spec.md` 작성 — 프론트가 Mock으로 작업 시작 가능
- [x] `docs/schema.md` 작성
- [x] 표준 응답 엔벨로프 합의 (`status/data/error`)
- [ ] (배포 후) 프론트엔드 `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 전달
