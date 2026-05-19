-- AItem Scout — Row Level Security policies
-- Strategy:
--   - profiles/projects/saved_items/source_citations: owner-only access for authenticated users.
--   - search_caches/search_logs: anon/authenticated blocked. Edge Functions use service-role key.
--   - Public share viewing: handled by the `share` Edge Function using the service-role key
--     (RLS not relaxed for anon to keep the surface minimal).

alter table public.profiles          enable row level security;
alter table public.projects          enable row level security;
alter table public.saved_items       enable row level security;
alter table public.source_citations  enable row level security;
alter table public.search_caches     enable row level security;
alter table public.search_logs       enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- profile insert is handled by the on_auth_user_created trigger (security definer).

-- ---------- projects ----------
drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete to authenticated
  using (owner_id = auth.uid());

-- ---------- saved_items ----------
drop policy if exists saved_items_select_own on public.saved_items;
create policy saved_items_select_own on public.saved_items
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = saved_items.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists saved_items_insert_own on public.saved_items;
create policy saved_items_insert_own on public.saved_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = saved_items.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists saved_items_update_own on public.saved_items;
create policy saved_items_update_own on public.saved_items
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = saved_items.project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = saved_items.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists saved_items_delete_own on public.saved_items;
create policy saved_items_delete_own on public.saved_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = saved_items.project_id and p.owner_id = auth.uid()
    )
  );

-- ---------- source_citations ----------
drop policy if exists citations_select_own on public.source_citations;
create policy citations_select_own on public.source_citations
  for select to authenticated
  using (
    exists (
      select 1
      from public.saved_items i
      join public.projects p on p.id = i.project_id
      where i.id = source_citations.saved_item_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists citations_write_own on public.source_citations;
create policy citations_write_own on public.source_citations
  for all to authenticated
  using (
    exists (
      select 1
      from public.saved_items i
      join public.projects p on p.id = i.project_id
      where i.id = source_citations.saved_item_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.saved_items i
      join public.projects p on p.id = i.project_id
      where i.id = source_citations.saved_item_id and p.owner_id = auth.uid()
    )
  );

-- ---------- search_caches / search_logs ----------
-- Intentionally no policies — RLS is enabled, default-deny.
-- Edge Functions must use the service-role client to read/write.
