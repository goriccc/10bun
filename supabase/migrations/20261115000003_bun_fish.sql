-- =====================================================================
-- 14 모두의 어항
-- 포만감과 갱신 시각만 저장하고, 현재 값은 읽을 때 계산한다.
-- 낮 08~22시에는 12분이면 100이 0이 되고, 밤에는 36분이 걸린다.
-- 먹이 한 알 +16. 0 이하면 굶주림, 100 을 넘으면 과식.
-- 기기당 하루 3회, 연속 급여는 60초 간격. 먹이는 행 잠금으로 한 번에 하나씩.
-- 떠난 물고기 기록은 남긴다. 먹이 기록은 30일 뒤 지운다.
-- =====================================================================

insert into public.bun_config (key, value, note) values
  ('switch.fish',            'true', '모두의 어항'),
  ('paused_until.fish',      'null', '회로 차단기가 어항을 멈춘 시각'),
  ('fish.daily_feeds',       '3',    '기기당 하루 먹이 횟수'),
  ('fish.cooldown_seconds',  '60',   '같은 기기의 연속 먹이 간격(초)')
on conflict (key) do nothing;

create table if not exists public.bun_fish (
  id            smallint primary key default 1 check (id = 1),
  generation    int not null,
  fullness      numeric(6,2) not null,
  updated_at    timestamptz not null,
  born_at       timestamptz not null,
  alive         boolean not null,
  died_at       timestamptz,
  death_reason  text,
  last_region   text
);

insert into public.bun_fish (id, generation, fullness, updated_at, born_at, alive)
values (1, 1, 60, now(), now(), true)
on conflict (id) do nothing;

create table if not exists public.bun_fish_past (
  generation    int primary key,
  born_at       timestamptz not null,
  died_at       timestamptz not null,
  death_reason  text not null,
  last_region   text,
  feeders       int not null
);

create table if not exists public.bun_fish_feeds (
  id          bigint generated always as identity primary key,
  generation  int not null,
  device_id   uuid not null references public.bun_players (device_id) on delete cascade,
  region      text not null,
  fed_at      timestamptz not null default now()
);
create index if not exists bun_fish_feeds_device_idx on public.bun_fish_feeds (device_id, fed_at desc);
create index if not exists bun_fish_feeds_gen_idx on public.bun_fish_feeds (generation);

create or replace function public.bun_fish_fullness(p_full numeric, p_at timestamptz, p_now timestamptz default now())
returns numeric language plpgsql stable set search_path = public, pg_temp
as $$
declare
  v numeric := p_full;
  t timestamptz := p_at;
  step interval := interval '60 seconds';
  rate numeric;
  kst_hour int;
begin
  if p_now <= p_at or p_full <= 0 then return greatest(p_full, 0); end if;
  while t < p_now and v > 0 loop
    kst_hour := extract(hour from t at time zone 'Asia/Seoul')::int;
    if kst_hour >= 8 and kst_hour < 22 then rate := 100.0 / 720.0;
    else rate := 100.0 / 2160.0; end if;
    v := v - rate * extract(epoch from least(p_now - t, step));
    t := t + step;
  end loop;
  if v < 0 then v := 0; end if;
  return round(v, 2);
end $$;

create or replace function public.bun_fish_apply(p_now timestamptz default now())
returns public.bun_fish language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  f public.bun_fish%rowtype;
  v numeric;
begin
  select * into f from public.bun_fish where id = 1 for update;
  if not found or not f.alive then return f; end if;
  v := public.bun_fish_fullness(f.fullness, f.updated_at, p_now);
  if v <= 0 then
    update public.bun_fish
       set fullness = 0, updated_at = p_now, alive = false, died_at = p_now, death_reason = '굶주림'
     where id = 1
    returning * into f;
  else
    update public.bun_fish set fullness = v, updated_at = p_now where id = 1
    returning * into f;
  end if;
  return f;
end $$;

create or replace function public.bun_feed_fish(p_device uuid, p_region text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  f public.bun_fish%rowtype;
  v_left int;
  v_last timestamptz;
begin
  if not public.bun_enabled('fish') then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;
  if p_region is null or not (p_region = any (public.bun_regions())) then
    return jsonb_build_object('ok', false, 'code', 'bad_region');
  end if;
  if not exists (select 1 from public.bun_players where device_id = p_device) then
    return jsonb_build_object('ok', false, 'code', 'no_player');
  end if;
  if exists (select 1 from public.bun_players where device_id = p_device and banned) then
    return jsonb_build_object('ok', false, 'code', 'blocked');
  end if;
  f := public.bun_fish_apply(now());
  if f.id is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if not f.alive then return jsonb_build_object('ok', false, 'code', 'dead'); end if;
  select count(*) into v_left from public.bun_fish_feeds
   where device_id = p_device and (fed_at at time zone 'Asia/Seoul')::date = public.bun_today();
  if v_left >= public.bun_cfg_num('fish.daily_feeds', 3)::int then
    return jsonb_build_object('ok', false, 'code', 'no_attempts');
  end if;
  select max(fed_at) into v_last from public.bun_fish_feeds where device_id = p_device;
  if v_last is not null and v_last > now() - make_interval(secs => public.bun_cfg_num('fish.cooldown_seconds', 60)::int) then
    return jsonb_build_object('ok', false, 'code', 'too_fast');
  end if;
  f.fullness := f.fullness + 16;
  insert into public.bun_fish_feeds (generation, device_id, region) values (f.generation, p_device, p_region);
  if f.fullness > 100 then
    update public.bun_fish
       set fullness = f.fullness, updated_at = now(), alive = false, died_at = now(),
           death_reason = '과식', last_region = p_region
     where id = 1;
    return jsonb_build_object('ok', true, 'dead', true, 'reason', '과식', 'left', public.bun_cfg_num('fish.daily_feeds', 3) - v_left - 1);
  end if;
  update public.bun_fish set fullness = f.fullness, updated_at = now(), last_region = p_region where id = 1;
  return jsonb_build_object('ok', true, 'dead', false, 'fullness', f.fullness, 'left', public.bun_cfg_num('fish.daily_feeds', 3) - v_left - 1);
end $$;

create or replace function public.bun_hatch_fish()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  f public.bun_fish%rowtype;
  v_feeders int;
begin
  if not public.bun_enabled('fish') then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;
  select * into f from public.bun_fish where id = 1 for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if f.alive then return jsonb_build_object('ok', false, 'code', 'alive'); end if;
  select count(distinct device_id) into v_feeders from public.bun_fish_feeds where generation = f.generation;
  insert into public.bun_fish_past (generation, born_at, died_at, death_reason, last_region, feeders)
  values (f.generation, f.born_at, coalesce(f.died_at, now()), coalesce(f.death_reason, '굶주림'), f.last_region, v_feeders)
  on conflict (generation) do nothing;
  update public.bun_fish
     set generation = f.generation + 1, fullness = 60, updated_at = now(), born_at = now(),
         alive = true, died_at = null, death_reason = null, last_region = null
   where id = 1;
  return jsonb_build_object('ok', true, 'generation', f.generation + 1);
end $$;

create or replace function public.bun_get_fish(p_device uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  f public.bun_fish%rowtype;
  v_left int := public.bun_cfg_num('fish.daily_feeds', 3)::int;
  v_feeds jsonb;
  v_past jsonb;
  v_feeders int;
  v_used int := 0;
begin
  f := public.bun_fish_apply(now());
  if f.id is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_device is not null then
    select count(*) into v_used from public.bun_fish_feeds
     where device_id = p_device and (fed_at at time zone 'Asia/Seoul')::date = public.bun_today();
    v_left := v_left - v_used;
  end if;
  select count(distinct device_id) into v_feeders from public.bun_fish_feeds where generation = f.generation;
  select coalesce(jsonb_agg(jsonb_build_object('region', region, 'at', fed_at) order by fed_at desc), '[]'::jsonb)
    into v_feeds
    from (
      select region, fed_at from public.bun_fish_feeds
       where generation = f.generation
       order by fed_at desc
       limit 8
    ) s;
  select coalesce(jsonb_agg(jsonb_build_object(
           'generation', generation, 'born_at', born_at, 'died_at', died_at,
           'reason', death_reason, 'region', last_region, 'feeders', feeders
         ) order by generation desc), '[]'::jsonb)
    into v_past
    from public.bun_fish_past;
  return jsonb_build_object(
    'ok', true,
    'enabled', public.bun_enabled('fish'),
    'fish', jsonb_build_object(
      'generation', f.generation, 'fullness', f.fullness, 'born_at', f.born_at,
      'alive', f.alive, 'died_at', f.died_at, 'reason', f.death_reason, 'region', f.last_region,
      'feeders', v_feeders),
    'left', greatest(v_left, 0),
    'recent', v_feeds,
    'past', v_past);
end $$;

create or replace function public.bun_tick_fish()
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare f public.bun_fish%rowtype;
begin
  f := public.bun_fish_apply(now());
  return coalesce(f.alive, false);
end $$;

create or replace function public.bun_purge_fish_feeds()
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n int;
begin
  delete from public.bun_fish_feeds where fed_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

alter table public.bun_fish enable row level security;
alter table public.bun_fish_past enable row level security;
alter table public.bun_fish_feeds enable row level security;

do $$
declare fn text;
  fns text[] := array[
    'public.bun_fish_fullness(numeric, timestamptz, timestamptz)',
    'public.bun_fish_apply(timestamptz)',
    'public.bun_feed_fish(uuid, text)',
    'public.bun_hatch_fish()',
    'public.bun_get_fish(uuid)',
    'public.bun_tick_fish()',
    'public.bun_purge_fish_feeds()'
  ];
begin
  revoke all on public.bun_fish from public, bun_app;
  revoke all on public.bun_fish_past from public, bun_app;
  revoke all on public.bun_fish_feeds from public, bun_app;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.bun_fish from anon;
    revoke all on public.bun_fish_past from anon;
    revoke all on public.bun_fish_feeds from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.bun_fish from authenticated;
    revoke all on public.bun_fish_past from authenticated;
    revoke all on public.bun_fish_feeds from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on public.bun_fish from service_role;
    revoke all on public.bun_fish_past from service_role;
    revoke all on public.bun_fish_feeds from service_role;
  end if;
  foreach fn in array fns loop
    execute format('revoke all on function %s from public, bun_app', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('revoke all on function %s from service_role', fn); end if;
  end loop;
end $$;

grant execute on function public.bun_feed_fish(uuid, text) to bun_app;
grant execute on function public.bun_hatch_fish() to bun_app;
grant execute on function public.bun_get_fish(uuid) to bun_app;
