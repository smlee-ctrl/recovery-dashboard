-- Recovery Dashboard: one private document store per signed-in user, plus a private video bucket.

create table if not exists public.rd_docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  path       text        not null,          -- e.g. logs/food/<id>, prefs, sources/whoop/2026-11
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, path)
);

alter table public.rd_docs enable row level security;

create policy "rd_docs: read own"   on public.rd_docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "rd_docs: insert own" on public.rd_docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "rd_docs: update own" on public.rd_docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "rd_docs: delete own" on public.rd_docs for delete to authenticated using ((select auth.uid()) = user_id);

-- Set videos: private, 20 MB each, stored under <user id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 20971520, array['video/*'])
on conflict (id) do nothing;

create policy "videos: read own"   on storage.objects for select to authenticated using (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "videos: upload own" on storage.objects for insert to authenticated with check (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "videos: delete own" on storage.objects for delete to authenticated using (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
