-- =====================================================================
-- 11 몇 개일까, 12 다수결, 13 가장 작은 유일한 숫자, 16 내일 기온
-- 운영자가 개발 데이터베이스 SQL 편집기에서 실행한다.
-- 공용 선택 표. 집계 전에는 다른 사람의 값을 돌려주지 않는다.
-- 11·12는 다음날 0시, 13은 당일 22시, 16은 예측일 18시까지 수정, 대상일 18시 이후 채점.
-- 16의 비교값은 기상청 단기예보 최고기온이다.
-- TODO(운영자 확인): 관측(ASOS) 키가 있으면 예보 대신 관측 최고기온으로 바꾼다.
-- 지도·인원 같은 운영 숫자는 설정값. offwork 는 다른 파일.
-- =====================================================================

insert into public.bun_config (key, value, note) values
  ('switch.picks',     'true', '몇 개일까·다수결·유일한 숫자·내일 기온'),
  ('paused_until.picks','null', '회로 차단기가 선택을 멈춘 시각'),
  ('picks.ip_devices', '8',    '같은 IP 해시에서 게임별 하루 기기 수 상한')
on conflict (key) do nothing;

create table if not exists public.bun_daily_picks (
  game_id    smallint not null check (game_id in (11, 12, 13, 16)),
  play_date  date not null,
  device_id  uuid not null references public.bun_players (device_id) on delete cascade,
  value      jsonb not null,
  ip_hash    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_id, play_date, device_id)
);
create index if not exists bun_daily_picks_ip_idx on public.bun_daily_picks (game_id, play_date, ip_hash);

create table if not exists public.bun_pick_results (
  game_id   smallint not null check (game_id in (11, 12, 13)),
  play_date date not null,
  result    jsonb not null,
  primary key (game_id, play_date)
);

create table if not exists public.bun_count_answers (
  play_date date primary key,
  answer    int not null check (answer between 1 and 5000)
);

create table if not exists public.bun_forecast_refs (
  play_date date not null,
  region    text not null,
  high      numeric(4,1) not null,
  primary key (play_date, region)
);

create or replace function public.bun_kst_ts(p_date date, p_hour int)
returns timestamptz language sql immutable set search_path = public, pg_temp
as $$ select (p_date::timestamp + make_interval(hours => p_hour)) at time zone 'Asia/Seoul' $$;

create or replace function public.bun_set_count_answer(p_date date, p_answer int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_answer is null or p_answer < 1 or p_answer > 5000 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  insert into public.bun_count_answers (play_date, answer) values (p_date, p_answer)
  on conflict (play_date) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bun_set_forecast_ref(p_date date, p_region text, p_high numeric)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_region is null or not (p_region = any (public.bun_regions())) then
    return jsonb_build_object('ok', false, 'code', 'bad_region');
  end if;
  if p_high is null or p_high < -40 or p_high > 50 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  insert into public.bun_forecast_refs (play_date, region, high)
  values (p_date, p_region, round(p_high, 1))
  on conflict (play_date, region) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bun_forecast_gaps(p_target date)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(distinct p.value->>'region'), '[]'::jsonb)
    from public.bun_daily_picks p
   where p.game_id = 16
     and p.play_date = p_target - 1
     and (p.value->>'region') = any (public.bun_regions())
     and not exists (
       select 1 from public.bun_forecast_refs r
        where r.play_date = p_target and r.region = p.value->>'region')
$$;

create or replace function public.bun_pick_value_ok(p_game smallint, p_value jsonb)
returns boolean language plpgsql stable set search_path = public, pg_temp
as $$
declare
  n int;
  guess numeric;
  region text;
  elem text;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then return false; end if;
  if p_game = 11 then
    return (p_value->>'guess') ~ '^[0-9]+$'
       and (p_value->>'guess')::int between 1 and 5000;
  elsif p_game = 12 then
    if jsonb_typeof(p_value->'choices') <> 'array' or jsonb_array_length(p_value->'choices') <> 3 then
      return false;
    end if;
    for elem in select jsonb_array_elements_text(p_value->'choices') loop
      if elem !~ '^[0-3]$' then return false; end if;
    end loop;
    return true;
  elsif p_game = 13 then
    return (p_value->>'n') ~ '^[0-9]+$' and (p_value->>'n')::int between 1 and 100;
  elsif p_game = 16 then
    region := p_value->>'region';
    guess := (p_value->>'guess')::numeric;
    return region = any (public.bun_regions())
       and guess is not null and guess between -15 and 40;
  end if;
  return false;
exception when others then
  return false;
end $$;

create or replace function public.bun_put_pick(p_device uuid, p_game smallint, p_value jsonb, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_today date := public.bun_today();
  n int;
begin
  if not public.bun_enabled('picks') then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;
  if p_game not in (11, 12, 13, 16) then return jsonb_build_object('ok', false, 'code', 'bad_game'); end if;
  if not public.bun_pick_value_ok(p_game, p_value) then return jsonb_build_object('ok', false, 'code', 'bad_request'); end if;
  if not exists (select 1 from public.bun_players where device_id = p_device) then
    return jsonb_build_object('ok', false, 'code', 'no_player');
  end if;
  if exists (select 1 from public.bun_players where device_id = p_device and banned) then
    return jsonb_build_object('ok', false, 'code', 'blocked');
  end if;
  if p_game = 13 and now() >= public.bun_kst_ts(v_today, 22) then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;
  if p_game = 16 and now() >= public.bun_kst_ts(v_today, 18) then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;
  select count(distinct device_id) into n
    from public.bun_daily_picks
   where game_id = p_game and play_date = v_today and ip_hash = p_ip_hash and device_id <> p_device;
  if n >= public.bun_cfg_num('picks.ip_devices', 8) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;
  if p_game = 16 then
    insert into public.bun_daily_picks (game_id, play_date, device_id, value, ip_hash)
    values (16, v_today, p_device, jsonb_build_object('region', p_value->>'region', 'guess', round((p_value->>'guess')::numeric, 1)), p_ip_hash)
    on conflict (game_id, play_date, device_id)
    do update set value = excluded.value, ip_hash = excluded.ip_hash, updated_at = now();
    return jsonb_build_object('ok', true);
  end if;
  insert into public.bun_daily_picks (game_id, play_date, device_id, value, ip_hash)
  values (p_game, v_today, p_device, p_value, p_ip_hash)
  on conflict (game_id, play_date, device_id) do nothing;
  if not found then return jsonb_build_object('ok', false, 'code', 'already'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bun_close_picks()
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  d date;
  n int := 0;
  v_answer int;
  v_median numeric;
  v_people int;
  v_bins jsonb;
  v_qs jsonb;
  v_counts jsonb;
  v_winner int;
begin
  for d in
    select a.play_date from public.bun_count_answers a
     where a.play_date < public.bun_today()
       and not exists (select 1 from public.bun_pick_results r where r.game_id = 11 and r.play_date = a.play_date)
  loop
    select answer into v_answer from public.bun_count_answers where play_date = d;
    select count(*) into v_people from public.bun_daily_picks where game_id = 11 and play_date = d;
    select percentile_cont(0.5) within group (order by (value->>'guess')::numeric)
      into v_median
      from public.bun_daily_picks where game_id = 11 and play_date = d;
    select coalesce(jsonb_agg(jsonb_build_object('lo', lo, 'hi', hi, 'count', c) order by lo), '[]'::jsonb)
      into v_bins
      from (
        select width_bucket((value->>'guess')::numeric, 1, 5000, 12) as bucket,
               min((value->>'guess')::int) as lo,
               max((value->>'guess')::int) as hi,
               count(*)::int as c
          from public.bun_daily_picks
         where game_id = 11 and play_date = d
         group by 1
      ) b;
    insert into public.bun_pick_results (game_id, play_date, result)
    values (11, d, jsonb_build_object('answer', v_answer, 'participants', v_people, 'median', v_median, 'bins', v_bins));
    n := n + 1;
  end loop;

  for d in
    select distinct play_date from public.bun_daily_picks
     where game_id = 12 and play_date < public.bun_today()
       and not exists (select 1 from public.bun_pick_results r where r.game_id = 12 and r.play_date = play_date)
  loop
    select coalesce(jsonb_agg(q.row order by q.idx), '[]'::jsonb) into v_qs
      from (
        select idx, jsonb_build_object(
          'counts', array[c0, c1, c2, c3],
          'winner', (array[0,1,2,3])[array_position(array[c0,c1,c2,c3], greatest(c0,c1,c2,c3))]
        ) as row
          from (
            select g.idx,
                   count(*) filter (where (p.value#>>array['choices', g.idx::text])::int = 0)::int as c0,
                   count(*) filter (where (p.value#>>array['choices', g.idx::text])::int = 1)::int as c1,
                   count(*) filter (where (p.value#>>array['choices', g.idx::text])::int = 2)::int as c2,
                   count(*) filter (where (p.value#>>array['choices', g.idx::text])::int = 3)::int as c3
              from generate_series(0, 2) g(idx)
              left join public.bun_daily_picks p on p.game_id = 12 and p.play_date = d
             group by g.idx
          ) s
      ) q;
    select count(*) into v_people from public.bun_daily_picks where game_id = 12 and play_date = d;
    insert into public.bun_pick_results (game_id, play_date, result)
    values (12, d, jsonb_build_object('participants', v_people, 'questions', v_qs));
    n := n + 1;
  end loop;

  for d in
    select gs::date from generate_series(public.bun_today() - 2, public.bun_today(), interval '1 day') gs
     where now() >= public.bun_kst_ts(gs::date, 22)
       and not exists (select 1 from public.bun_pick_results r where r.game_id = 13 and r.play_date = gs::date)
  loop
    select coalesce(jsonb_agg(jsonb_build_object('n', s.n, 'count', s.c) order by s.n), '[]'::jsonb),
           min(s.n) filter (where s.c = 1)
      into v_counts, v_winner
      from (
        select gs.n, count(p.device_id)::int as c
          from generate_series(1, 100) gs(n)
          left join public.bun_daily_picks p
            on p.game_id = 13 and p.play_date = d and (p.value->>'n')::int = gs.n
         group by gs.n
      ) s;
    select count(*) into v_people from public.bun_daily_picks where game_id = 13 and play_date = d;
    insert into public.bun_pick_results (game_id, play_date, result)
    values (13, d, jsonb_build_object('participants', v_people, 'winner', v_winner, 'counts', v_counts));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.bun_get_pick(p_device uuid, p_game smallint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_today date := public.bun_today();
  v_mine jsonb;
  v_people int;
  v_result jsonb;
  v_result_date date;
  v_result_mine jsonb;
  v_open boolean;
  v_rank int;
  v_region text;
  v_high numeric;
  v_guess numeric;
  v_near int;
begin
  if p_game not in (11, 12, 13, 16) then return jsonb_build_object('ok', false, 'code', 'bad_game'); end if;
  select value into v_mine from public.bun_daily_picks
   where game_id = p_game and play_date = v_today and device_id = p_device;
  select count(*) into v_people from public.bun_daily_picks where game_id = p_game and play_date = v_today;
  v_open := case
    when p_game = 13 then now() < public.bun_kst_ts(v_today, 22)
    when p_game = 16 then now() < public.bun_kst_ts(v_today, 18)
    else true
  end;
  select play_date, result into v_result_date, v_result
    from public.bun_pick_results
   where game_id = p_game
   order by play_date desc
   limit 1;
  if v_result_date is not null then
    select value into v_result_mine from public.bun_daily_picks
     where game_id = p_game and play_date = v_result_date and device_id = p_device;
  end if;
  if p_game = 16 and v_mine is not null then
    v_region := v_mine->>'region';
    v_guess := (v_mine->>'guess')::numeric;
    select high into v_high from public.bun_forecast_refs
     where play_date = v_today + 1 and region = v_region;
  end if;
  if p_game = 16 then
    select p.value, r.high into v_result_mine, v_high
      from public.bun_daily_picks p
      left join public.bun_forecast_refs r
        on r.play_date = v_today and r.region = p.value->>'region'
     where p.game_id = 16 and p.play_date = v_today - 1 and p.device_id = p_device;
    if v_result_mine is not null and v_high is not null then
      select count(*)::int into v_near
        from public.bun_daily_picks o
        join public.bun_forecast_refs r on r.play_date = v_today and r.region = o.value->>'region'
       where o.game_id = 16 and o.play_date = v_today - 1
         and o.value->>'region' = v_result_mine->>'region'
         and abs((o.value->>'guess')::numeric - r.high) < abs((v_result_mine->>'guess')::numeric - v_high);
      select count(*)::int into v_people
        from public.bun_daily_picks
       where game_id = 16 and play_date = v_today - 1 and value->>'region' = v_result_mine->>'region';
      v_rank := coalesce(v_near, 0) + 1;
      v_result := jsonb_build_object(
        'region', v_result_mine->>'region',
        'guess', (v_result_mine->>'guess')::numeric,
        'high', v_high,
        'error', round(abs((v_result_mine->>'guess')::numeric - v_high), 1),
        'rank', v_rank,
        'participants', v_people);
    elsif v_result_mine is not null then
      v_result := jsonb_build_object('region', v_result_mine->>'region', 'guess', (v_result_mine->>'guess')::numeric, 'pending', true);
    end if;
    select count(*) into v_people from public.bun_daily_picks where game_id = 16 and play_date = v_today;
  end if;
  return jsonb_build_object(
    'ok', true,
    'enabled', public.bun_enabled('picks'),
    'open', v_open,
    'participants', v_people,
    'mine', v_mine,
    'closed', case when v_result is null then null else jsonb_build_object('date', coalesce(v_result_date, v_today - 1), 'result', v_result, 'mine', case when p_game = 16 then null else v_result_mine end) end);
end $$;

create or replace function public.bun_purge_picks()
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n int;
begin
  delete from public.bun_daily_picks where play_date < public.bun_today() - 30;
  get diagnostics n = row_count;
  delete from public.bun_pick_results where play_date < public.bun_today() - 30;
  delete from public.bun_count_answers where play_date < public.bun_today() - 30;
  delete from public.bun_forecast_refs where play_date < public.bun_today() - 30;
  return n;
end $$;

alter table public.bun_daily_picks enable row level security;
alter table public.bun_pick_results enable row level security;
alter table public.bun_count_answers enable row level security;
alter table public.bun_forecast_refs enable row level security;

do $$
declare fn text;
  fns text[] := array[
    'public.bun_kst_ts(date, int)',
    'public.bun_set_count_answer(date, int)',
    'public.bun_set_forecast_ref(date, text, numeric)',
    'public.bun_forecast_gaps(date)',
    'public.bun_pick_value_ok(smallint, jsonb)',
    'public.bun_put_pick(uuid, smallint, jsonb, text)',
    'public.bun_close_picks()',
    'public.bun_get_pick(uuid, smallint)',
    'public.bun_purge_picks()'
  ];
begin
  revoke all on public.bun_daily_picks from public, bun_app;
  revoke all on public.bun_pick_results from public, bun_app;
  revoke all on public.bun_count_answers from public, bun_app;
  revoke all on public.bun_forecast_refs from public, bun_app;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.bun_daily_picks from anon;
    revoke all on public.bun_pick_results from anon;
    revoke all on public.bun_count_answers from anon;
    revoke all on public.bun_forecast_refs from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.bun_daily_picks from authenticated;
    revoke all on public.bun_pick_results from authenticated;
    revoke all on public.bun_count_answers from authenticated;
    revoke all on public.bun_forecast_refs from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on public.bun_daily_picks from service_role;
    revoke all on public.bun_pick_results from service_role;
    revoke all on public.bun_count_answers from service_role;
    revoke all on public.bun_forecast_refs from service_role;
  end if;
  foreach fn in array fns loop
    execute format('revoke all on function %s from public, bun_app', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('revoke all on function %s from service_role', fn); end if;
  end loop;
end $$;

grant execute on function public.bun_set_count_answer(date, int) to bun_app;
grant execute on function public.bun_set_forecast_ref(date, text, numeric) to bun_app;
grant execute on function public.bun_forecast_gaps(date) to bun_app;
grant execute on function public.bun_put_pick(uuid, smallint, jsonb, text) to bun_app;
grant execute on function public.bun_get_pick(uuid, smallint) to bun_app;
