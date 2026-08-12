alter table public.budget_imports
  add column if not exists source_type text not null default 'excel'
  check (source_type in ('excel', 'manual'));
