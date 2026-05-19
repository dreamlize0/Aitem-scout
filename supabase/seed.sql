-- AItem Scout — Development seed data.
-- Runs ONLY on `supabase db reset` / local stack init — supabase CLI does not
-- apply this file during `supabase migration up` or production deploys. That's
-- by design: this file ships demo profile/project/items so the frontend can
-- render against a real local Supabase instance instead of in-memory mocks.
--
-- Production never sees these rows. If you need to bootstrap a fresh prod
-- environment, write a deliberate migration with non-predictable share tokens.

do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-00000000beef';
  v_project_a uuid := '11111111-1111-1111-1111-111111111111';
  v_project_b uuid := '22222222-2222-2222-2222-222222222222';
  v_item_1 uuid := gen_random_uuid();
  v_item_2 uuid := gen_random_uuid();
  v_item_3 uuid := gen_random_uuid();
begin
  -- Only seed if the demo profile slot is empty. Skip otherwise to keep idempotent.
  if exists (select 1 from public.profiles where id = v_user_id) then
    return;
  end if;

  -- NOTE: For the dev seed to work, an auth.users row with id=v_user_id must exist.
  -- Supabase local stack lets you create one via `supabase auth signup` or seed.sql.
  -- If absent, the FK insert below will fail; comment this block out or create the user first.
  if not exists (select 1 from auth.users where id = v_user_id) then
    raise notice 'Skipping seed: auth.users(% ) not found. Create the dev user first.', v_user_id;
    return;
  end if;

  insert into public.profiles (id, display_name, workspace_name)
  values (v_user_id, 'Demo Creator', 'Demo Workspace');

  insert into public.projects (id, owner_id, name, description, share_enabled, share_token)
  values
    (v_project_a, v_user_id, '골프 채널 기획', '30-40대 남성 타겟 골프 콘텐츠', true, 'demo-share-golf-202605'),
    (v_project_b, v_user_id, '시니어 여행 브이로그', '50대 부모님과 함께하는 국내 여행', false, null);

  insert into public.saved_items
    (id, project_id, title, summary, thumbnail_url, source_url, source_platform, recommendation_reason, metadata, position)
  values
    (v_item_1, v_project_a,
     '제주 9홀 가성비 골프장 BEST 5',
     '주말 6만원대 부킹 가능 코스 모음',
     'https://picsum.photos/seed/golf1/640/360',
     'https://blog.naver.com/example/golf-jeju',
     'naver',
     '30-40대 남성 타겟에 잘 맞는 가성비 코스 큐레이션. 네이버 블로그 조회수 상승 중.',
     '{"views_7d": 12480, "naver_rank": 3}'::jsonb,
     0),
    (v_item_2, v_project_a,
     '레슨 프로 인터뷰 — 입문자 흔한 실수 7',
     'YouTube Shorts 평균 조회수 18만',
     'https://picsum.photos/seed/golf2/640/360',
     'https://www.youtube.com/watch?v=demo-golf-2',
     'youtube',
     '쇼츠 친화 포맷. 입문자 키워드 클릭률 상위 1%.',
     '{"avg_views": 180000, "is_shorts": true}'::jsonb,
     1),
    (v_item_3, v_project_b,
     '강릉 1박 2일 효도 코스',
     '걷기 부담 적은 동선 위주',
     'https://picsum.photos/seed/senior1/640/360',
     'https://www.instagram.com/p/demo-senior-1',
     'instagram',
     '시니어 동반 시 이동 거리/식사 시간 고려. 인스타 저장 수 급증.',
     '{"saves": 8210}'::jsonb,
     0);

  insert into public.source_citations (saved_item_id, platform, url, excerpt)
  values
    (v_item_1, 'naver',     'https://blog.naver.com/example/golf-jeju', '주말 6만원대 부킹...'),
    (v_item_2, 'youtube',   'https://www.youtube.com/watch?v=demo-golf-2', '레슨 프로 김XX...'),
    (v_item_3, 'instagram', 'https://www.instagram.com/p/demo-senior-1', '강릉 효도 1박 2일...');
end $$;
