create extension if not exists pgcrypto;

create or replace function public.knowledge_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  article_type text not null default 'troubleshooting',
  category text,
  system_name text,
  symptom text,
  possible_cause text,
  summary text,
  keywords text,
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_articles_article_type_check
    check (article_type in ('troubleshooting', 'guide')),
  constraint knowledge_articles_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint knowledge_articles_title_check
    check (length(trim(title)) > 0)
);

create table if not exists public.knowledge_steps (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  step_order integer not null,
  title text,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_steps_step_order_check check (step_order > 0),
  constraint knowledge_steps_article_step_order_key unique (article_id, step_order)
);

create table if not exists public.knowledge_assets (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  step_id uuid references public.knowledge_steps(id) on delete set null,
  storage_path text not null,
  original_filename text,
  mime_type text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint knowledge_assets_storage_path_key unique (storage_path),
  constraint knowledge_assets_size_check check (size_bytes > 0 and size_bytes <= 524288),
  constraint knowledge_assets_mime_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint knowledge_assets_dimensions_check check (
    (width is null or width > 0) and
    (height is null or height > 0)
  )
);

create index if not exists knowledge_articles_status_sort_idx
  on public.knowledge_articles(status, sort_order, updated_at desc);

create index if not exists knowledge_articles_type_category_idx
  on public.knowledge_articles(article_type, category, system_name);

create index if not exists knowledge_articles_search_idx
  on public.knowledge_articles
  using gin (to_tsvector('simple',
    coalesce(title, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(system_name, '') || ' ' ||
    coalesce(symptom, '') || ' ' ||
    coalesce(possible_cause, '') || ' ' ||
    coalesce(summary, '') || ' ' ||
    coalesce(keywords, '')
  ));

create index if not exists knowledge_steps_article_order_idx
  on public.knowledge_steps(article_id, step_order);

create index if not exists knowledge_assets_article_order_idx
  on public.knowledge_assets(article_id, sort_order, created_at);

create index if not exists knowledge_assets_step_order_idx
  on public.knowledge_assets(step_id, sort_order, created_at)
  where step_id is not null;

drop trigger if exists knowledge_articles_set_updated_at on public.knowledge_articles;
create trigger knowledge_articles_set_updated_at
  before update on public.knowledge_articles
  for each row
  execute function public.knowledge_set_updated_at();

drop trigger if exists knowledge_steps_set_updated_at on public.knowledge_steps;
create trigger knowledge_steps_set_updated_at
  before update on public.knowledge_steps
  for each row
  execute function public.knowledge_set_updated_at();

alter table public.knowledge_articles enable row level security;
alter table public.knowledge_steps enable row level security;
alter table public.knowledge_assets enable row level security;

grant select on public.knowledge_articles to anon, authenticated;
grant select on public.knowledge_steps to anon, authenticated;
grant select on public.knowledge_assets to anon, authenticated;

grant select, insert, update, delete on public.knowledge_articles to service_role;
grant select, insert, update, delete on public.knowledge_steps to service_role;
grant select, insert, update, delete on public.knowledge_assets to service_role;

drop policy if exists "Allow public read published knowledge articles" on public.knowledge_articles;
create policy "Allow public read published knowledge articles"
  on public.knowledge_articles
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Allow public read published knowledge steps" on public.knowledge_steps;
create policy "Allow public read published knowledge steps"
  on public.knowledge_steps
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.knowledge_articles article
      where article.id = knowledge_steps.article_id
        and article.status = 'published'
    )
  );

drop policy if exists "Allow public read published knowledge assets" on public.knowledge_assets;
create policy "Allow public read published knowledge assets"
  on public.knowledge_assets
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.knowledge_articles article
      where article.id = knowledge_assets.article_id
        and article.status = 'published'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-images',
  'knowledge-images',
  false,
  524288,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 524288,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Allow service role to manage knowledge images" on storage.objects;
create policy "Allow service role to manage knowledge images"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'knowledge-images')
  with check (bucket_id = 'knowledge-images');
