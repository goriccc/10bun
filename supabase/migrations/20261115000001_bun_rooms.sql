-- =====================================================================
-- 18 친구 대결방
-- 운영자가 개발 데이터베이스 SQL 편집기에서 실행한다.
-- 기존 함수의 이름, 인자, 반환은 바꾸지 않는다.
-- 방 점수는 새로 저장하지 않고 참여자의 bun_best 를 읽을 때 계산한다.
-- 방 코드는 혼동 글자(0, 1, I, O)를 뺀 8자. 인원 상한은 room.members_max.
-- 겨룰 게임은 1번부터 6번까지.
-- =====================================================================

insert into public.bun_config (key, value, note) values
  ('switch.rooms',       'true', '친구 대결방 만들기와 입장'),
  ('paused_until.rooms', 'null', '회로 차단기가 대결방을 멈춘 시각'),
  ('room.members_max',   '30',   '방 한 개의 인원 상한'),
  ('room.days',          '7',    '방을 유지하는 일수')
on conflict (key) do nothing;

create table if not exists public.bun_rooms (
  code         text primary key,
  name         text not null check (char_length(name) between 1 and 20),
  game_id      smallint not null references public.bun_games (game_id),
  owner_device uuid references public.bun_players (device_id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  check (game_id between 1 and 6),
  check (expires_at > created_at)
);
create index if not exists bun_rooms_expires_idx on public.bun_rooms (expires_at);

create table if not exists public.bun_room_members (
  code       text not null references public.bun_rooms (code) on delete cascade,
  device_id  uuid not null references public.bun_players (device_id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (code, device_id)
);
create index if not exists bun_room_members_device_idx on public.bun_room_members (device_id);

create or replace function public.bun_valid_room_name(p text)
returns boolean language sql stable set search_path = public, pg_temp
as $$
  select p is not null
     and char_length(btrim(p)) between 1 and 20
     and btrim(p) ~ '^[가-힣a-zA-Z0-9]+( [가-힣a-zA-Z0-9]+)*$'
     and not exists (
       select 1 from public.bun_banned_words w
        where position(lower(w.word) in lower(replace(btrim(p), ' ', ''))) > 0)
$$;

create or replace function public.bun_room_code()
returns text language plpgsql volatile set search_path = public, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea := uuid_send(gen_random_uuid());
  out text := '';
  i int;
begin
  for i in 0..7 loop
    out := out || substr(alphabet, (get_byte(raw, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end $$;

create or replace function public.bun_create_room(p_device uuid, p_name text, p_game smallint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(p_name);
  v_code text;
  v_exp timestamptz;
  v_joined timestamptz;
  attempt int;
begin
  if not public.bun_enabled('rooms') then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;
  if not exists (select 1 from public.bun_players where device_id = p_device) then
    return jsonb_build_object('ok', false, 'code', 'no_player');
  end if;
  if exists (select 1 from public.bun_players where device_id = p_device and banned) then
    return jsonb_build_object('ok', false, 'code', 'blocked');
  end if;
  if not public.bun_valid_room_name(v_name) then return jsonb_build_object('ok', false, 'code', 'bad_name'); end if;
  if p_game is null or p_game < 1 or p_game > 6
     or not exists (select 1 from public.bun_games where game_id = p_game) then
    return jsonb_build_object('ok', false, 'code', 'bad_game');
  end if;
  v_exp := now() + make_interval(days => public.bun_cfg_num('room.days', 7)::int);
  for attempt in 1..5 loop
    v_code := public.bun_room_code();
    begin
      insert into public.bun_rooms (code, name, game_id, owner_device, expires_at)
      values (v_code, v_name, p_game, p_device, v_exp);
      insert into public.bun_room_members (code, device_id)
      values (v_code, p_device)
      returning joined_at into v_joined;
      return jsonb_build_object('ok', true, 'code', v_code, 'expires_at', v_exp, 'joined_at', v_joined);
    exception when unique_violation then
      null;
    end;
  end loop;
  return jsonb_build_object('ok', false, 'code', 'retry');
end $$;

create or replace function public.bun_join_room(p_device uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.bun_rooms%rowtype;
  n int;
  v_joined timestamptz;
begin
  if not public.bun_enabled('rooms') then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;
  if not exists (select 1 from public.bun_players where device_id = p_device) then
    return jsonb_build_object('ok', false, 'code', 'no_player');
  end if;
  if exists (select 1 from public.bun_players where device_id = p_device and banned) then
    return jsonb_build_object('ok', false, 'code', 'blocked');
  end if;
  select * into r from public.bun_rooms where code = upper(btrim(p_code)) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.expires_at <= now() then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select count(*) into n from public.bun_room_members where code = r.code;
  if n >= public.bun_cfg_num('room.members_max', 30)
     and not exists (select 1 from public.bun_room_members where code = r.code and device_id = p_device) then
    return jsonb_build_object('ok', false, 'code', 'full');
  end if;
  insert into public.bun_room_members (code, device_id) values (r.code, p_device)
  on conflict (code, device_id) do nothing;
  select joined_at into v_joined from public.bun_room_members where code = r.code and device_id = p_device;
  return jsonb_build_object('ok', true, 'code', r.code, 'joined_at', v_joined);
end $$;

create or replace function public.bun_get_room(p_code text, p_device uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.bun_rooms%rowtype;
  v_rows jsonb;
begin
  select * into r from public.bun_rooms where code = upper(btrim(p_code));
  if not found or r.expires_at <= now() then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  with days as (
    select generate_series(
      (r.created_at at time zone 'Asia/Seoul')::date,
      least(public.bun_today(), (r.expires_at at time zone 'Asia/Seoul')::date),
      interval '1 day'
    )::date as play_date
  ),
  played as (
    select m.device_id, d.play_date, b.sort_key, b.achieved_at
      from public.bun_room_members m
      cross join days d
      join public.bun_best b
        on b.device_id = m.device_id and b.game_id = r.game_id and b.play_date = d.play_date
     where m.code = r.code
  ),
  wins as (
    select device_id, count(*)::int as wins
      from (
        select distinct on (play_date) device_id
          from played
         order by play_date, sort_key, achieved_at
      ) w
     group by device_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', q.rank,
           'nickname', q.nickname,
           'today_score', q.today_score,
           'played_today', q.played_today,
           'wins', q.wins,
           'is_me', q.is_me,
           'joined_at', q.joined_at
         ) order by q.rank), '[]'::jsonb)
    into v_rows
    from (
      select row_number() over (
               order by b.sort_key nulls last, b.achieved_at nulls last, m.joined_at
             ) as rank,
             p.nickname,
             b.best_score as today_score,
             (b.device_id is not null) as played_today,
             coalesce(w.wins, 0) as wins,
             (m.device_id = p_device) as is_me,
             m.joined_at
        from public.bun_room_members m
        join public.bun_players p on p.device_id = m.device_id
        left join public.bun_best b
          on b.device_id = m.device_id and b.game_id = r.game_id and b.play_date = public.bun_today()
        left join wins w on w.device_id = m.device_id
       where m.code = r.code
    ) q;
  return jsonb_build_object(
    'ok', true,
    'enabled', public.bun_enabled('rooms'),
    'room', jsonb_build_object(
      'code', r.code, 'name', r.name, 'game_id', r.game_id,
      'created_at', r.created_at, 'expires_at', r.expires_at),
    'rows', v_rows);
end $$;

create or replace function public.bun_purge_rooms()
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  delete from public.bun_rooms where expires_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;

alter table public.bun_rooms enable row level security;
alter table public.bun_room_members enable row level security;

do $$
declare
  fn text;
  fns text[] := array[
    'public.bun_valid_room_name(text)',
    'public.bun_room_code()',
    'public.bun_create_room(uuid, text, smallint)',
    'public.bun_join_room(uuid, text)',
    'public.bun_get_room(text, uuid)',
    'public.bun_purge_rooms()'
  ];
begin
  revoke all on public.bun_rooms from public, bun_app;
  revoke all on public.bun_room_members from public, bun_app;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.bun_rooms from anon;
    revoke all on public.bun_room_members from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.bun_rooms from authenticated;
    revoke all on public.bun_room_members from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on public.bun_rooms from service_role;
    revoke all on public.bun_room_members from service_role;
  end if;
  foreach fn in array fns loop
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

grant execute on function public.bun_create_room(uuid, text, smallint) to bun_app;
grant execute on function public.bun_join_room(uuid, text) to bun_app;
grant execute on function public.bun_get_room(text, uuid) to bun_app;
