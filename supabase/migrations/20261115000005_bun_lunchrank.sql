-- =====================================================================
-- 20 오늘의 점심 집계
-- 메뉴·시도·시각만 모으고, 하루 한 번은 익명 키로 막는다.
-- 평일에만 받고, 순위는 오늘 기록만으로 계산한다.
-- =====================================================================

insert into public.bun_config (key, value, note) values
  ('switch.lunchrank',       'true', '오늘의 점심 집계'),
  ('paused_until.lunchrank', 'null', '회로 차단기가 점심 집계를 멈춘 시각')
on conflict (key) do nothing;

create table if not exists public.bun_lunch_picks (
  play_date date not null,
  anon      text not null,
  menu      text not null check (char_length(menu) between 1 and 20),
  region    text not null,
  picked_at timestamptz not null default now(),
  primary key (play_date, anon)
);
create index if not exists bun_lunch_menu_idx on public.bun_lunch_picks (play_date, menu);

create or replace function public.bun_lunch_tap(p_anon text, p_menu text, p_region text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.bun_enabled('lunchrank') then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;
  if extract(dow from public.bun_today()) in (0, 6) then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;
  if p_anon is null or char_length(p_anon) < 16 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  if p_menu is null or char_length(btrim(p_menu)) < 1 or char_length(btrim(p_menu)) > 20 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  if p_region is null or not (p_region = any (public.bun_regions())) then
    return jsonb_build_object('ok', false, 'code', 'bad_region');
  end if;
  insert into public.bun_lunch_picks (play_date, anon, menu, region)
  values (public.bun_today(), p_anon, btrim(p_menu), p_region)
  on conflict (play_date, anon) do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'already', 'menu', (
      select menu from public.bun_lunch_picks where play_date = public.bun_today() and anon = p_anon));
  end if;
  return jsonb_build_object('ok', true, 'menu', btrim(p_menu));
end $$;

create or replace function public.bun_lunch_board()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
  v_total int;
begin
  select count(*) into v_total from public.bun_lunch_picks where play_date = public.bun_today();
  select coalesce(jsonb_agg(jsonb_build_object('menu', menu, 'count', c) order by c desc, menu), '[]'::jsonb)
    into v_rows
    from (
      select menu, count(*)::int as c
        from public.bun_lunch_picks
       where play_date = public.bun_today()
       group by menu
    ) s;
  return jsonb_build_object(
    'ok', true,
    'enabled', public.bun_enabled('lunchrank'),
    'weekday', extract(dow from public.bun_today()) not in (0, 6),
    'total', v_total,
    'rows', v_rows);
end $$;

create or replace function public.bun_purge_lunch()
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n int;
begin
  delete from public.bun_lunch_picks where play_date < public.bun_today() - 30;
  get diagnostics n = row_count;
  return n;
end $$;

alter table public.bun_lunch_picks enable row level security;

do $$
declare fn text;
  fns text[] := array[
    'public.bun_lunch_tap(text, text, text)',
    'public.bun_lunch_board()',
    'public.bun_purge_lunch()'
  ];
begin
  revoke all on public.bun_lunch_picks from public, bun_app;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.bun_lunch_picks from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.bun_lunch_picks from authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then revoke all on public.bun_lunch_picks from service_role; end if;
  foreach fn in array fns loop
    execute format('revoke all on function %s from public, bun_app', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('revoke all on function %s from service_role', fn); end if;
  end loop;
end $$;

grant execute on function public.bun_lunch_tap(text, text, text) to bun_app;
grant execute on function public.bun_lunch_board() to bun_app;
