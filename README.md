# AItem Scout

AI가 키워드·테마·타겟 맞춤형 촬영 아이템을 빠르게 발굴해주는 영상 제작자용 AI 아이템 소싱 플랫폼.

자세한 제품 정의는 [`PRD.md`](./PRD.md), 협업·아키텍처 결정은 [`architecture_plan.md`](./architecture_plan.md) 참조.

## 저장소 레이아웃 (모노레포)

```
AItem Scout/
├── PRD.md                # 제품 요구사항
├── architecture_plan.md  # 협업 및 아키텍처 가이드
├── frontend/             # Next.js 16 웹앱 (Antigravity 담당 영역)
│   └── README.md
└── supabase/             # Edge Functions + DB 마이그레이션 (Claude 담당 영역)
    └── README.md
```

루트는 두 서브프로젝트의 메타 문서만 담고, 빌드·환경변수·실행은 각 서브 디렉터리에서 처리합니다.

## 빠른 시작

### 1. 백엔드 (선택 — Mock 모드만 쓸 거면 건너뛰어도 OK)

```bash
cd supabase
cp .env.example .env                          # 키 채우기
supabase link --project-ref <project-ref>     # 한 번만
supabase db push                              # 마이그레이션 적용
supabase secrets set --env-file .env
supabase functions deploy search projects saved-items share
```

자세한 검증·로컬 실행: [`supabase/README.md`](./supabase/README.md)

### 2. 프론트엔드

```bash
cd frontend
cp .env.example .env.local                    # 비워두면 Mock 모드
npm install
npm run dev                                   # http://localhost:3000
```

자세한 동작·검증: [`frontend/README.md`](./frontend/README.md)

## 핵심 설계 원칙 (요약)

- **Contract First**: `supabase/docs/api-spec.md`가 단일 진실 공급원. 프론트 `src/lib/types.ts`와 동기화 유지.
- **모듈형 커넥터**: `supabase/functions/_shared/connectors/`에 새 SNS/검색 소스를 파일 한 개로 추가 가능.
- **Graceful Degradation**: 키 누락·외부 API 실패 시 그 커넥터만 비활성. 다른 커넥터는 정상 동작 — 부분 성공 응답.
- **캐싱**: 동일 쿼리는 24h 캐시. `force_refresh: true`로 우회.
- **Mock 모드**: 프론트는 Supabase 환경변수가 비어 있으면 자동 Mock으로 동작 — 백엔드 없이 UI 개발 가능.

## 검증 명령

```bash
# Frontend 정적 검증
cd frontend && npx tsc --noEmit && npx eslint src

# Backend 정적 검증 (Deno 필요)
cd supabase/functions && deno check **/*.ts && deno lint
```
