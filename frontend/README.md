# AItem Scout — Frontend (`/frontend`)

영상 제작자를 위한 AI 기반 아이템 소싱 플랫폼 **AItem Scout**의 웹 프론트엔드. `architecture_plan.md` §1.1 (Antigravity 담당) 영역입니다.

## 기술 스택

- **Next.js 16** (App Router, `proxy.ts` 기반 인증 가드 — 구 `middleware.ts` 호환)
- **React 19**
- **Tailwind CSS v4** (CSS 변수 + dark-only 테마, `src/app/globals.css`)
- **Zustand** — 검색 상태 (`src/store/useSearchStore.ts`)
- **Supabase Client** (`@supabase/supabase-js` + `@supabase/ssr`)
- **lucide-react** 아이콘

## 폴더 구조

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # 루트 레이아웃 (다크 테마 + Inter 폰트)
│   │   ├── globals.css                 # Tailwind v4 + 디자인 토큰
│   │   ├── (auth)/login/page.tsx       # OAuth 로그인 (Google/GitHub)
│   │   ├── (dashboard)/                # 라우트 그룹 — Sidebar 레이아웃 공유
│   │   │   ├── layout.tsx              # Sidebar + ConfirmProvider
│   │   │   ├── page.tsx                # / (Hero ↔ 검색 결과)
│   │   │   ├── settings/page.tsx       # /settings
│   │   │   └── storage/                # /storage, /storage/[id]
│   │   ├── (public)/shared/[token]/    # /shared/[token] — 비로그인 공유 뷰
│   │   └── auth/callback/route.ts      # OAuth 콜백
│   ├── components/                     # 재사용 UI (Sidebar, ReportDetailPanel, …)
│   ├── lib/
│   │   ├── api.ts                      # 백엔드 호출 + 에러 정규화
│   │   ├── supabase.ts                 # 브라우저 client
│   │   ├── supabase-server.ts          # 서버 컴포넌트/route 핸들러 client
│   │   ├── useAuth.ts                  # 세션 구독 훅
│   │   ├── types.ts                    # API DTO (supabase/docs/api-spec.md와 동기화)
│   │   └── mockData.ts                 # Supabase 미설정 시 Mock 응답
│   ├── store/useSearchStore.ts         # 검색 상태 (response, lastSearchedAt 등)
│   └── proxy.ts                        # Next 16 proxy — auth 가드 + cookie refresh
└── .env.example
```

## 빠른 시작

```bash
cp .env.example .env.local             # 비워두면 Mock 모드
npm install
npm run dev                            # http://localhost:3000
```

> Supabase 환경변수가 비어 있으면 자동으로 **Mock 모드**(`src/lib/mockData.ts`)로 동작합니다. UI 작업이나 디자인 폴리싱은 백엔드 없이 진행 가능.

## 환경변수

`.env.example` 참조.

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 백엔드 연동 시 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 백엔드 연동 시 | Supabase anon (public) key |
| `NEXT_PUBLIC_SITE_URL` | 배포 시 | OAuth 리다이렉트 + 공유 링크 절대 URL |

미설정 시 검색은 Mock, OAuth 버튼은 비활성화됩니다.

## 핵심 동작 결정

- **Contract First**: DTO는 `src/lib/types.ts`. 변경 전 `supabase/docs/api-spec.md`와 대조 — 스펙이 우선.
- **인증 가드**: `proxy.ts`가 `/storage`, `/settings` prefix를 보호. 로그인된 유저가 `/login` 진입 시 `?next` 또는 `/`로 자동 리다이렉트.
- **검색 API 인증**: 백엔드 `/search`가 `requireUser`로 인증 강제 → `(dashboard)/page.tsx`의 `requireAuthOrLogin()`이 비로그인 사용자를 사전에 `/login?next=/`로 보냅니다 (Mock 모드는 예외).
- **Graceful Degradation**: `response.connectors.failed`를 받아 설정 페이지의 커넥터 상태 칩에 표시 (`/settings`).

## 검증 명령

```bash
npx tsc --noEmit                       # 타입 체크
npx eslint src                         # 린트
npx next build                         # 빌드 검증 (선택)
```

## 작업 가이드

- Next.js 16에서 일부 API가 변경됨 — 새 라우트/훅 추가 시 `frontend/AGENTS.md`와 `node_modules/next/dist/docs/`를 우선 확인.
- 라이트 모드 미지원 — `dark` 클래스가 root `<html>`에 고정.
- 디자인 토큰(`var(--color-primary)` 등)은 `globals.css`에 모두 정의됨. 커스텀 hex를 새로 박지 말고 토큰 우선 사용.
