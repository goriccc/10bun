-- =====================================================================
-- 19 실시간 퇴근 현황판
-- 시도·시각만 모으고, 하루 한 번은 익명 키로 막는다. 기기 번호는 저장하지 않는다.
-- 조회는 5분 단위로 묶어 읽고, 캐시는 앱에서 10초.
-- 인원이 offwork.map_min 보다 적으면 합계만 돌려준다.
-- TODO(운영자 확인): 공휴일 달력은 없다. 토·일요일만 막는다. map_min 기본값 30.
-- =====================================================================

insert into public.bun_config (key, value, note) values
  ('switch.offwork',       'true', '실시간 퇴근 현황판'),
  ('paused_until.offwork', 'null', '회로 차단기가 퇴근 기록을 멈춘 시각'),
  ('offwork.map_min',      '30',   '시도별 지도를 여는 최소 인원')
on conflict (key) do nothing;

create table if not exists public.bun_offwork (
  play_date date not null,
  anon      text not null,
  region    text not null,
  tapped_at timestamptz not null default now(),
  primary key (play_date, anon)
);
create index if not exists bun_offwork_region_idx on public.bun_offwork (play_date, region);

create or replace function public.bun_offwork_tap(p_anon text, p_region text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.bun_enabled('offwork') then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;
  if extract(dow from public.bun_today()) in (0, 6) then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;
  if p_anon is null or char_length(p_anon) < 16 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  if p_region is null or not (p_region = any (public.bun_regions())) then
    return jsonb_build_object('ok', false, 'code', 'bad_region');
  end if;
  insert into public.bun_offwork (play_date, anon, region)
  values (public.bun_today(), p_anon, p_region)
  on conflict (play_date, anon) do nothing;
  if not found then return jsonb_build_object('ok', false, 'code', 'already'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bun_offwork_board()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_total int;
  v_min int := public.bun_cfg_num('offwork.map_min', 30)::int;
  v_regions jsonb;
  v_hours jsonb;
begin
  select count(*) into v_total from public.bun_offwork where play_date = public.bun_today();
  if v_total >= v_min then
    select coalesce(jsonb_agg(jsonb_build_object('region', region, 'count', c) order by region), '[]'::jsonb)
      into v_regions
      from (
        select region, count(*)::int as c
          from public.bun_offwork
         where play_date = public.bun_today()
         group by region
      ) s;
  else
    v_regions := '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('slot', slot, 'count', c) order by slot), '[]'::jsonb)
    into v_hours
    from (
      select to_char(
               date_trunc('hour', tapped_at at time zone 'Asia/Seoul')
               + make_interval(mins => (extract(minute from tapped_at at time zone 'Asia/Seoul')::int / 5) * 5),
               'HH24:MI') as slot,
             count(*)::int as c
        from public.bun_offwork
       where play_date = public.bun_today()
       group by 1
    ) h;
  return jsonb_build_object(
    'ok', true,
    'enabled', public.bun_enabled('offwork'),
    'weekday', extract(dow from public.bun_today()) not in (0, 6),
    'total', v_total,
    'map', v_total >= v_min,
    'regions', v_regions,
    'hours', v_hours);
end $$;

create or replace function public.bun_purge_offwork()
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n int;
begin
  delete from public.bun_offwork where play_date < public.bun_today() - 30;
  get diagnostics n = row_count;
  return n;
end $$;

alter table public.bun_offwork enable row level security;

do $$
declare fn text;
  fns text[] := array[
    'public.bun_offwork_tap(text, text)',
    'public.bun_offwork_board()',
    'public.bun_purge_offwork()'
  ];
begin
  revoke all on public.bun_offwork from public, bun_app;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.bun_offwork from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.bun_offwork from authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then revoke all on public.bun_offwork from service_role; end if;
  foreach fn in array fns loop
    execute format('revoke all on function %s from public, bun_app', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('revoke all on function %s from service_role', fn); end if;
  end loop;
end $$;

grant execute on function public.bun_offwork_tap(text, text) to bun_app;
grant execute on function public.bun_offwork_board() to bun_app;
