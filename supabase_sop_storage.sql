-- SOC SOP Storage setup.
-- Run manually in the Supabase SQL Editor before running scripts/upload-soc-sop.ts.
-- Current SOC SOP object key: soc/soc-mis-checklist-official.xlsx

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.sop_documents (
  id uuid primary key default gen_random_uuid(),
  category text,
  title text,
  version text,
  description text,
  file_path text,
  file_url text,
  updated_at timestamptz default now()
);

alter table public.sop_documents
  add column if not exists category text,
  add column if not exists title text,
  add column if not exists version text,
  add column if not exists description text,
  add column if not exists file_path text,
  add column if not exists file_url text,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists sop_documents_category_file_path_key
  on public.sop_documents(category, file_path);

create index if not exists sop_documents_category_idx
  on public.sop_documents(category);

drop trigger if exists sop_documents_set_updated_at on public.sop_documents;
create trigger sop_documents_set_updated_at
  before update on public.sop_documents
  for each row
  execute function public.set_updated_at();

alter table public.sop_documents enable row level security;

grant select on public.sop_documents to anon, authenticated;
grant select, insert, update, delete on public.sop_documents to service_role;

drop policy if exists "Allow public read access to SOP documents" on public.sop_documents;
create policy "Allow public read access to SOP documents"
  on public.sop_documents
  for select
  to anon, authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sop-files',
  'sop-files',
  true,
  52428800,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow public read access to SOP files" on storage.objects;
create policy "Allow public read access to SOP files"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'sop-files');

drop policy if exists "Allow service role to manage SOP files" on storage.objects;
create policy "Allow service role to manage SOP files"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'sop-files')
  with check (bucket_id = 'sop-files');
