# DB Schema — AItem Scout

본 문서는 백엔드 ↔ 프론트엔드 동기화 포인트입니다. 모든 테이블은 `public` 스키마, `auth.users`는 Supabase 기본 인증 테이블입니다.

## 관계도

```
auth.users (Supabase)
   └─1:1─ profiles
              └─1:N─ projects
                         ├─1:N─ saved_items
                         │          └─1:N─ source_citations
                         └─(share_token, share_enabled)
search_caches  (전역 — service role 전용)
search_logs    (관찰성 — service role 전용)
```

## 테이블

### `profiles`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | `uuid` PK | `references auth.users(id) on delete cascade` |
| `display_name` | `text` | 닉네임 |
| `workspace_name` | `text` | 기본값 'My Workspace' |
| `created_at` | `timestamptz` | default now() |
| `updated_at` | `timestamptz` | default now() (trigger 갱신) |

### `projects`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | `uuid` PK | default `gen_random_uuid()` |
| `owner_id` | `uuid` | FK → profiles.id, on delete cascade |
| `name` | `text` not null |  |
| `description` | `text` |  |
| `share_token` | `text` unique nullable | nanoid(20) 또는 uuid |
| `share_enabled` | `boolean` not null default false |  |
| `created_at` | `timestamptz` default now() |  |
| `updated_at` | `timestamptz` default now() | trigger |

인덱스: `projects(owner_id)`, `projects(share_token)`

### `saved_items`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | `uuid` PK |  |
| `project_id` | `uuid` | FK → projects.id, on delete cascade |
| `title` | `text` not null |  |
| `summary` | `text` |  |
| `thumbnail_url` | `text` |  |
| `source_url` | `text` not null |  |
| `source_platform` | `source_platform` enum | naver, kakao, youtube, instagram, x, threads, google_trends, web |
| `recommendation_reason` | `text` | LLM 생성 |
| `metadata` | `jsonb` | 원본 응답 + 추가 메타 |
| `position` | `int` default 0 | 정렬용 |
| `created_at` | `timestamptz` default now() |  |

인덱스: `saved_items(project_id, position)`

### `source_citations`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | `uuid` PK |  |
| `saved_item_id` | `uuid` | FK → saved_items.id, on delete cascade |
| `platform` | `source_platform` enum |  |
| `url` | `text` not null | 새 창 Out-link |
| `excerpt` | `text` |  |

### `search_caches`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | `uuid` PK |  |
| `cache_key` | `text` unique not null | sha256(normalized JSON of query+filters) |
| `payload` | `jsonb` not null | 응답 전체 |
| `expires_at` | `timestamptz` not null | now() + ttl |
| `created_at` | `timestamptz` default now() |  |

인덱스: `search_caches(cache_key)`, partial `search_caches(expires_at) where expires_at > now()`

### `search_logs`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | `uuid` PK |  |
| `user_id` | `uuid` nullable | auth.users.id 참조 (관찰용, 삭제 시 set null) |
| `query` | `text` |  |
| `filters` | `jsonb` |  |
| `connectors_used` | `text[]` |  |
| `connectors_failed` | `text[]` |  |
| `cache_hit` | `boolean` default false |  |
| `latency_ms` | `int` |  |
| `created_at` | `timestamptz` default now() |  |

## Enum

```
source_platform = ('naver','kakao','youtube','instagram','x','threads','google_trends','web')
```

## RLS 요약

- `profiles`, `projects`, `saved_items`, `source_citations`: 본인 소유 row만 접근. 익명 차단.
- `search_caches`, `search_logs`: anon/authenticated 둘 다 차단 — 엣지펑션이 **service role**로만 접근.
- 공개 공유는 RLS를 통과시키지 않고, `share` 엣지펑션이 **service role**로 토큰 검증 후 직접 반환.
