-- 15 슬라이드 퍼즐: 하루 그림 배정 (버킷 대기열 기억)
-- 파일은 Storage bun-puzzle. 일정표 JSON 없음.

create table if not exists public.bun_puzzle_days (
  play_date   date primary key,
  file_name   text not null,
  assigned_at timestamptz not null default now()
);

alter table public.bun_puzzle_days enable row level security;

create or replace function public.bun_puzzle_get(p_date date)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select file_name from public.bun_puzzle_days where play_date = p_date
$$;

create or replace function public.bun_puzzle_assign(p_date date, p_file text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f text;
begin
  if p_file is null or length(trim(p_file)) = 0 then
    return null;
  end if;
  select file_name into f from public.bun_puzzle_days where play_date = p_date;
  if found then return f; end if;
  insert into public.bun_puzzle_days (play_date, file_name)
  values (p_date, trim(p_file))
  on conflict (play_date) do nothing;
  select file_name into f from public.bun_puzzle_days where play_date = p_date;
  return f;
end
$$;

create or replace function public.bun_puzzle_shown()
returns setof text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct file_name from public.bun_puzzle_days
$$;

create or replace function public.bun_puzzle_past(p_before date)
returns table(play_date date, file_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.play_date, d.file_name
  from public.bun_puzzle_days d
  where d.play_date < p_before
  order by d.play_date desc
  limit 30
$$;

do $$
declare
  fn text;
begin
  revoke all on public.bun_puzzle_days from public, bun_app;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.bun_puzzle_days from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.bun_puzzle_days from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on public.bun_puzzle_days from service_role;
  end if;
  foreach fn in array array[
    'public.bun_puzzle_get(date)',
    'public.bun_puzzle_assign(date, text)',
    'public.bun_puzzle_shown()',
    'public.bun_puzzle_past(date)'
  ] loop
    execute format('revoke all on function %s from public, bun_app', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('revoke all on function %s from service_role', fn);
    end if;
  end loop;
end $$;

grant execute on function public.bun_puzzle_get(date) to bun_app;
grant execute on function public.bun_puzzle_assign(date, text) to bun_app;
grant execute on function public.bun_puzzle_shown() to bun_app;
grant execute on function public.bun_puzzle_past(date) to bun_app;
