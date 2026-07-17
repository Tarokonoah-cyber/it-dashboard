-- Keep contract pricing auditable while exposing history only to the server-side service role.
create schema if not exists private;

create table if not exists public.contract_price_history (
  id uuid primary key default gen_random_uuid(),
  contract_id text not null references public.contracts(id) on update cascade on delete cascade,
  amount numeric not null check (amount >= 0),
  effective_date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists contract_price_history_contract_date_idx
  on public.contract_price_history (contract_id, effective_date desc, created_at desc);

alter table public.contract_price_history enable row level security;

revoke all on table public.contract_price_history from anon, authenticated;
grant select, insert, update, delete on table public.contract_price_history to service_role;

create or replace function private.capture_contract_price_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  history_date date;
begin
  if new.amount is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    history_date := case
      when coalesce(new.start_date, '') ~ '^\d{4}-\d{2}-\d{2}$' then new.start_date::date
      else current_date
    end;
  elsif old.amount is distinct from new.amount then
    history_date := current_date;
  else
    return new;
  end if;

  insert into public.contract_price_history (contract_id, amount, effective_date, note)
  values (
    new.id,
    new.amount,
    history_date,
    case when tg_op = 'INSERT' then '合約建立價格' else '合約價格調整' end
  );

  return new;
end;
$$;

revoke all on function private.capture_contract_price_history() from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.capture_contract_price_history() to service_role;

drop trigger if exists contracts_capture_price_history on public.contracts;
create trigger contracts_capture_price_history
after insert or update of amount on public.contracts
for each row execute function private.capture_contract_price_history();

insert into public.contract_price_history (contract_id, amount, effective_date, note, created_at)
select
  contracts.id,
  contracts.amount,
  case
    when coalesce(contracts.start_date, '') ~ '^\d{4}-\d{2}-\d{2}$' then contracts.start_date::date
    else coalesce(contracts.created_at::date, current_date)
  end,
  '既有合約起始價格',
  coalesce(contracts.created_at, now())
from public.contracts
where contracts.amount is not null
  and not exists (
    select 1
    from public.contract_price_history history
    where history.contract_id = contracts.id
  );
