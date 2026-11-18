-- =====================================================================
-- 10분닷컴 01. 핵심 스키마 v1.2 (점수, 순위 캐시, 제출 RPC, 끄기 스위치, 보관 기간)
-- 실행 위치: 퀴즈오아시스 Supabase 프로젝트 SQL Editor (운영자가 직접)
--            로컬 개발은 supabase/migrations 로 자동 적용
-- 다시 실행해도 안전 (if not exists / create or replace / on conflict). 단, 예전 버전이 적용된 DB 위에는 적용 불가 (로컬은 supabase db reset)
-- 트랜잭션 구문(begin/commit)은 넣지 않음: Supabase CLI 와 SQL Editor 가 각자 처리
-- 원칙
--   1) 이름은 모두 bun_ 로 시작 (테이블, 함수, 뷰, 크론 작업)
--   2) 모든 bun_ 테이블은 RLS 켜고 정책 없음: anon/authenticated 는 읽기·쓰기 불가
--   3) 브라우저는 DB에 직접 접근하지 않음. Next.js 서버가 bun_app 역할로 bun_ API 함수만 호출
--   4) 날짜 기준은 한국 시간(Asia/Seoul). 매일 0시(KST)에 새 판
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 전용 역할 (로그인 불가 상태로 생성. 비밀번호는 00_bun_role.sql 에서 부여)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bun_app') then
    create role bun_app nologin noinherit;
  end if;
end $$;
grant usage on schema public to bun_app;

-- ---------------------------------------------------------------------
-- 1. 설정과 끄기 스위치
-- ---------------------------------------------------------------------
create table if not exists public.bun_config (
  key        text primary key,
  value      jsonb not null,
  note       text,
  updated_at timestamptz not null default now()
);

insert into public.bun_config (key, value, note) values
  ('switch.all',                       'true',  '10분닷컴 서버 기능 전체 스위치. false면 모든 bun_ 쓰기 거부'),
  ('switch.scores',                    'true',  '점수 제출과 순위 스위치'),
  ('paused_until.scores',              'null',  '회로 차단기가 자동으로 멈춘 경우 다시 열리는 시각'),
  ('limit.ips_per_min',                '1500',  '최근 1분 도전 시작의 서로 다른 IP 해시 수가 이 값을 넘으면 자동 일시정지(회로 차단기, bun_guard 가 매분 확인)'),
  ('limit.pause_minutes',              '10',    '자동 일시정지 시간(분)'),
  ('limit.ip_starts_per_min',          '20',    '같은 IP 해시의 게임별 1분당 도전 시작 상한'),
  ('limit.devices_per_ip_game_day',    '30',    '같은 IP 해시에서 게임별 하루 참여 기기 수 상한'),
  ('limit.ip_attempts_per_game_day',   '300',   '같은 IP 해시의 게임별 하루 도전 상한(최후 방어선)'),
  ('limit.attempt_ttl_minutes',        '60',    '도전 시작 후 제출할 수 있는 시간(분)'),
  ('limit.profile_change_seconds',     '10',    '별명·시도 변경 최소 간격(초)'),
  ('guard.db_warn_gb',                 '5',     'DB 전체 용량 경고 기준(GB). Pro 포함량 8GB'),
  ('guard.db_kill_gb',                 '7',     'DB 전체 용량이 넘으면 switch.scores 를 자동으로 끔'),
  ('retention.scores_days',            '30',    'bun_scores, bun_best 보관 일수'),
  ('retention.meta_days',              '2',     '최고 기록·검토 대상이 아닌 도전의 meta(그린 점 등) 보관 일수'),
  ('retention.points_days',            '60',    'bun_daily_points 보관 일수'),
  ('retention.history_days',           '400',   'bun_rank_history(일별 상위 100명) 보관 일수'),
  ('retention.players_days',           '90',    '마지막 방문 후 이 기간이 지난 기기 프로필 삭제')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. 기본 함수
-- ---------------------------------------------------------------------
create or replace function public.bun_today()
returns date language sql stable set search_path = public, pg_temp
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

create or replace function public.bun_week_start(p_day date default null)
returns date language sql stable set search_path = public, pg_temp
as $$ select date_trunc('week', coalesce(p_day, public.bun_today()))::date $$;   -- 월요일 시작

create or replace function public.bun_regions()
returns text[] language sql immutable set search_path = public, pg_temp
as $$ select array['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']::text[] $$;

-- '미정' 은 아직 시도를 고르지 않은 기기. 시도 대항 집계에서 제외
create or replace function public.bun_region_ok(p text)
returns boolean language sql immutable set search_path = public, pg_temp
as $$ select p is not null and (p = any (public.bun_regions()) or p = '미정') $$;

create or replace function public.bun_cfg_num(p_key text, p_default numeric)
returns numeric language sql stable set search_path = public, pg_temp
as $$ select coalesce((select (value #>> '{}')::numeric from public.bun_config where key = p_key), p_default) $$;

create or replace function public.bun_enabled(p_feature text)
returns boolean language sql stable set search_path = public, pg_temp
as $$
  select coalesce((select value = 'true'::jsonb from public.bun_config where key = 'switch.all'), false)
     and coalesce((select value = 'true'::jsonb from public.bun_config where key = 'switch.' || p_feature), false)
     and coalesce((select (value #>> '{}')::timestamptz <= now()
                     from public.bun_config
                    where key = 'paused_until.' || p_feature and value <> 'null'::jsonb), true)
$$;

create or replace function public.bun_sort_key(p_better text, p_score numeric)
returns numeric language sql immutable set search_path = public, pg_temp
as $$ select case when p_better = 'low' then p_score else -p_score end $$;

-- 10분닷컴 전용 advisory lock 네임스페이스 (퀴즈오아시스 잠금과 겹치지 않게 첫 키 고정)
create or replace function public.bun_lock(p_key text)
returns void language sql volatile set search_path = public, pg_temp
as $$ select pg_advisory_xact_lock(1010, hashtext(p_key)) $$;

-- ---------------------------------------------------------------------
-- 3. 게임 규칙 (서버가 기준)
-- ---------------------------------------------------------------------
create table if not exists public.bun_games (
  game_id             smallint primary key,
  slug                text not null unique,
  title               text not null,
  better              text not null check (better in ('low','high')),
  daily_attempts      smallint not null check (daily_attempts between 1 and 50),
  min_score           numeric not null,
  max_score           numeric not null,
  score_scale         smallint not null check (score_scale between 0 and 4),
  elapsed_check       boolean not null default false,
  elapsed_tolerance_s numeric not null default 3,
  review_at           numeric,               -- 사람 한계에 가까운 기록은 자동 검토(순위 보류)
  region_source       text not null default 'best' check (region_source in ('best','all')),
  is_active           boolean not null default true,
  check (min_score < max_score)
);

-- 점수 단위
--  1 정확히 10초: |게임 경과-목표| 초(소수 3자리), 낮을수록 좋음
--  2 오늘의 색: 0~50점(소수 2자리)          3 오늘의 도형: 0~100점(소수 2자리)
--  4 그때 그 가격: 0~1000점                  5 오늘의 동네: 시도수*1000 + 초(최대 999), 실패는 7000+초
--  6 숫자 만들기: 푼 시간(초)                 17 반응속도: 3회 평균 ms
-- review_at: 1번은 ±0.000 만 검토 (자정 직후 스크립트가 1위를 가져가는 것 방지. 운영자가 확인 후 일괄 통과)
insert into public.bun_games
  (game_id, slug, title, better, daily_attempts, min_score, max_score, score_scale,
   elapsed_check, elapsed_tolerance_s, review_at, region_source, is_active)
values
  ( 1, '10sec',    '오늘의 정확히 10초', 'low',  5,    0,   60, 3, true,  3,   0,    'best', true),
  ( 2, 'color',    '오늘의 색',          'high', 1,    0,   50, 2, false, 3,   49.5, 'best', true),
  ( 3, 'shape',    '오늘의 도형',        'high', 5,    0,  100, 2, false, 3,   99.5, 'best', true),
  ( 4, 'price',    '그때 그 가격',       'high', 1,    0, 1000, 0, false, 3,   null, 'best', false),  -- 2단계
  ( 5, 'dongne',   '오늘의 동네',        'low',  1, 1000, 7999, 0, true,  5,   null, 'best', false),  -- 2단계
  ( 6, 'number',   '오늘의 숫자 만들기', 'low',  1,    5, 3600, 0, true,  5,   12,   'best', true),
  (17, 'reaction', '시도 대항 반응속도', 'low',  5,  100, 2000, 0, false, 3,   150,  'all',  true)
on conflict (game_id) do update set
  slug = excluded.slug, title = excluded.title, better = excluded.better,
  daily_attempts = excluded.daily_attempts, min_score = excluded.min_score, max_score = excluded.max_score,
  score_scale = excluded.score_scale, elapsed_check = excluded.elapsed_check,
  elapsed_tolerance_s = excluded.elapsed_tolerance_s, review_at = excluded.review_at,
  region_source = excluded.region_source;
-- is_active 는 다시 실행해도 덮어쓰지 않음 (운영 중 켜고 끈 상태 보존)

-- ---------------------------------------------------------------------
-- 4. 기기 프로필 (로그인 없음. 기기 ID는 브라우저가 만든 UUID)
-- ---------------------------------------------------------------------
create table if not exists public.bun_players (
  device_id    uuid primary key,
  nickname     text not null check (char_length(nickname) between 2 and 8),
  region       text not null check (public.bun_region_ok(region)),
  banned       boolean not null default false,
  ban_reason   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),   -- 별명·시도 변경 시각
  last_seen_at timestamptz not null default now()    -- 마지막 도전 시작 시각
);

create table if not exists public.bun_banned_words (
  word text primary key
);
-- 사칭 방지 기본값. 욕설·광고 단어는 운영자가 직접 추가
insert into public.bun_banned_words (word) values ('관리자'), ('운영자'), ('admin'), ('10분닷컴'), ('공식')
on conflict do nothing;

create or replace function public.bun_valid_nickname(p text)
returns boolean language sql stable set search_path = public, pg_temp
as $$
  select p is not null
     and char_length(p) between 2 and 8
     and p ~ '^[가-힣a-zA-Z0-9]+( [가-힣a-zA-Z0-9]+)*$'
     and not exists (
       select 1 from public.bun_banned_words w
        where position(lower(w.word) in lower(replace(p, ' ', ''))) > 0)
$$;

-- ---------------------------------------------------------------------
-- 5. 점수 (도전 1번 = 1행. 시작할 때 만들어지고 제출할 때 채워짐)
-- ---------------------------------------------------------------------
create table if not exists public.bun_scores (
  id           bigint generated always as identity primary key,
  game_id      smallint not null references public.bun_games (game_id),
  play_date    date not null,
  device_id    uuid not null references public.bun_players (device_id) on delete cascade,
  attempt_no   smallint not null,
  region       text not null,                -- 시작 시점의 시도 (시도 대항 집계 기준)
  ip_hash      text not null,                -- 서버가 만든 날짜별 솔트 해시. 원본 IP 저장 금지
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  score        numeric(12,4),
  elapsed_s    numeric(10,3),
  meta         jsonb,
  status       text not null default 'started'
               check (status in ('started','submitted','flagged','expired','rejected')),
  flag_reason  text,
  unique (game_id, play_date, device_id, attempt_no)
);
create index if not exists bun_scores_ip_idx      on public.bun_scores (game_id, play_date, ip_hash);
create index if not exists bun_scores_ipmin_idx   on public.bun_scores (ip_hash, started_at);
create index if not exists bun_scores_started_idx on public.bun_scores (started_at);
create index if not exists bun_scores_date_idx    on public.bun_scores (play_date);
create index if not exists bun_scores_device_idx  on public.bun_scores (device_id);
create index if not exists bun_scores_sub_idx     on public.bun_scores (game_id, play_date) where status = 'submitted';

-- 기기별 오늘 최고 기록 (순위 계산은 이 표로)
create table if not exists public.bun_best (
  game_id     smallint not null references public.bun_games (game_id),
  play_date   date not null,
  device_id   uuid not null references public.bun_players (device_id) on delete cascade,
  best_score  numeric(12,4) not null,
  sort_key    numeric(12,4) not null,        -- low 게임은 점수, high 게임은 -점수 (작을수록 앞)
  achieved_at timestamptz not null,          -- 같은 기록이면 먼저 낸 사람이 앞
  score_id    bigint not null references public.bun_scores (id) on delete cascade,
  primary key (game_id, play_date, device_id)
);
create index if not exists bun_best_rank_idx   on public.bun_best (game_id, play_date, sort_key, achieved_at);
create index if not exists bun_best_score_idx  on public.bun_best (score_id);
create index if not exists bun_best_device_idx on public.bun_best (device_id);

-- ---------------------------------------------------------------------
-- 6. 순위 캐시, 일별 기록, 주간 점수, 알림
-- ---------------------------------------------------------------------
create table if not exists public.bun_rank_cache (
  game_id      smallint not null references public.bun_games (game_id),
  play_date    date not null,
  participants integer not null default 0,
  payload      jsonb not null,
  computed_at  timestamptz not null default now(),
  primary key (game_id, play_date)
);

create table if not exists public.bun_rank_history (
  game_id     smallint not null references public.bun_games (game_id),
  play_date   date not null,
  rank        integer not null,
  device_id   uuid,                          -- 내부용(삭제 요청 처리). 외부로 내보내지 않음
  nickname    text not null,
  region      text not null,
  score       numeric(12,4) not null,
  achieved_at timestamptz not null,
  primary key (game_id, play_date, rank)
);
create index if not exists bun_rank_history_device_idx on public.bun_rank_history (device_id);

create table if not exists public.bun_daily_points (
  game_id      smallint not null references public.bun_games (game_id),
  play_date    date not null,
  device_id    uuid not null references public.bun_players (device_id) on delete cascade,
  rank         integer not null,
  participants integer not null,
  points       smallint not null check (points between 0 and 100),
  primary key (game_id, play_date, device_id)
);
create index if not exists bun_daily_points_week_idx   on public.bun_daily_points (game_id, play_date);
create index if not exists bun_daily_points_device_idx on public.bun_daily_points (device_id);

-- 주간 순위 캐시 (하루 마감 때 한 번 계산)
create table if not exists public.bun_week_cache (
  game_id     smallint not null references public.bun_games (game_id),
  week_start  date not null,
  through     date not null,                 -- 이 날짜까지 반영
  top         jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (game_id, week_start)
);

-- 하루 마감 처리 기록 (중복 실행 방지)
create table if not exists public.bun_rollover_log (
  play_date date primary key,
  done_at   timestamptz not null default now(),
  result    jsonb
);

create table if not exists public.bun_alerts (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  level      text not null check (level in ('info','warn','kill')),
  code       text not null,
  message    text not null
);

-- ---------------------------------------------------------------------
-- 7. 내부 함수
-- ---------------------------------------------------------------------
create or replace function public.bun_rank_of(p_game smallint, p_date date, p_sort numeric, p_at timestamptz)
returns integer language sql stable set search_path = public, pg_temp
as $$
  select 1 + count(*)::int
    from public.bun_best b
   where b.game_id = p_game and b.play_date = p_date
     and (b.sort_key, b.achieved_at) < (p_sort, p_at)
$$;

create or replace function public.bun_pct(p_rank integer, p_n integer)
returns numeric language sql immutable set search_path = public, pg_temp
as $$ select greatest(0.1, round(100.0 * p_rank / greatest(p_n, 1), 1)) $$;

create or replace function public.bun_pause(p_feature text, p_minutes integer, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.bun_config (key, value, note)
  values ('paused_until.' || p_feature, to_jsonb(now() + make_interval(mins => p_minutes)), p_reason)
  on conflict (key) do update set value = excluded.value, note = excluded.note, updated_at = now();
  insert into public.bun_alerts (level, code, message)
  values ('warn', 'pause_' || p_feature, format('%s 기능을 %s분 일시정지: %s', p_feature, p_minutes, p_reason));
end $$;

-- 기기의 최고 기록을 남아 있는 정상 제출로 다시 계산 (검토 처리 때 사용)
create or replace function public.bun_recompute_best(p_game smallint, p_date date, p_device uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_better text;
begin
  select better into v_better from public.bun_games where game_id = p_game;
  delete from public.bun_best where game_id = p_game and play_date = p_date and device_id = p_device;
  insert into public.bun_best (game_id, play_date, device_id, best_score, sort_key, achieved_at, score_id)
  select s.game_id, s.play_date, s.device_id, s.score, public.bun_sort_key(v_better, s.score), s.submitted_at, s.id
    from public.bun_scores s
    join public.bun_players p on p.device_id = s.device_id and not p.banned
   where s.game_id = p_game and s.play_date = p_date and s.device_id = p_device and s.status = 'submitted'
   order by public.bun_sort_key(v_better, s.score), s.submitted_at
   limit 1;
end $$;

-- 주간 순위 계산 (week_start 주의 마감된 날들 합계)
create or replace function public.bun_refresh_week(p_week_start date)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare g record; v_top jsonb; v_through date;
begin
  for g in select * from public.bun_games loop
    select max(play_date) into v_through from public.bun_daily_points
     where game_id = g.game_id and play_date >= p_week_start and play_date < p_week_start + 7;
    continue when v_through is null;
    select coalesce(jsonb_agg(jsonb_build_object('rank', w.rk, 'nickname', w.nickname, 'region', w.region,
                                                 'points', w.pts, 'days', w.days) order by w.rk), '[]'::jsonb)
      into v_top
      from (select row_number() over (order by sum(dp.points) desc, count(*) desc, min(dp.rank)) rk,
                   p.nickname, p.region, sum(dp.points)::int pts, count(*)::int days
              from public.bun_daily_points dp
              join public.bun_players p on p.device_id = dp.device_id
             where dp.game_id = g.game_id and dp.play_date >= p_week_start and dp.play_date < p_week_start + 7
               and not p.banned
             group by dp.device_id, p.nickname, p.region
             order by sum(dp.points) desc, count(*) desc, min(dp.rank)
             limit 10) w;
    insert into public.bun_week_cache (game_id, week_start, through, top, computed_at)
    values (g.game_id, p_week_start, v_through, v_top, now())
    on conflict (game_id, week_start) do update set through = excluded.through, top = excluded.top, computed_at = now();
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. API 함수 (bun_app 만 실행 가능)
-- ---------------------------------------------------------------------

-- 8-1. 별명·시도 저장
create or replace function public.bun_set_profile(p_device uuid, p_nickname text, p_region text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_nick text := btrim(p_nickname);
  v_prev public.bun_players%rowtype;
begin
  if p_device is null then return jsonb_build_object('ok', false, 'code', 'bad_request'); end if;
  if not public.bun_valid_nickname(v_nick) then return jsonb_build_object('ok', false, 'code', 'bad_nickname'); end if;
  if not public.bun_region_ok(p_region) then return jsonb_build_object('ok', false, 'code', 'bad_region'); end if;

  select * into v_prev from public.bun_players where device_id = p_device for update;
  if found then
    if v_prev.banned then return jsonb_build_object('ok', false, 'code', 'blocked'); end if;
    if v_prev.updated_at > now() - make_interval(secs => public.bun_cfg_num('limit.profile_change_seconds', 10)) then
      return jsonb_build_object('ok', false, 'code', 'too_fast');
    end if;
    update public.bun_players set nickname = v_nick, region = p_region, updated_at = now() where device_id = p_device;
  else
    insert into public.bun_players (device_id, nickname, region) values (p_device, v_nick, p_region)
    on conflict (device_id) do nothing;   -- 동시에 처음 시작한 경우
  end if;
  return jsonb_build_object('ok', true, 'nickname', v_nick, 'region', p_region);
end $$;

-- 8-2. 도전 시작 (도전 횟수는 시작할 때 차감: 결과가 나쁘면 새로고침하는 꼼수 방지)
create or replace function public.bun_start_attempt(
  p_game smallint, p_device uuid, p_ip_hash text, p_nickname text, p_region text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g        public.bun_games%rowtype;
  v_today  date := public.bun_today();
  v_player public.bun_players%rowtype;
  v_prof   jsonb;
  v_n      integer;
  v_used   integer;
  v_id     bigint;
  v_new    boolean;
begin
  select * into g from public.bun_games where game_id = p_game;
  if not found or not g.is_active then return jsonb_build_object('ok', false, 'code', 'bad_game'); end if;
  if p_device is null or p_ip_hash is null or length(p_ip_hash) < 16 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  if not public.bun_enabled('scores') then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;

  -- 같은 IP 해시의 게임별 1분당 시작 상한
  select count(*) into v_n from public.bun_scores
   where ip_hash = p_ip_hash and game_id = p_game and started_at > now() - interval '1 minute';
  if v_n >= public.bun_cfg_num('limit.ip_starts_per_min', 20) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  select * into v_player from public.bun_players where device_id = p_device;
  v_new := not found;
  if not v_new and v_player.banned then return jsonb_build_object('ok', false, 'code', 'blocked'); end if;

  perform public.bun_lock(p_game::text || ':' || p_device::text || ':' || v_today::text);

  select count(*) into v_used from public.bun_scores
   where game_id = p_game and play_date = v_today and device_id = p_device;
  if v_used >= g.daily_attempts then
    return jsonb_build_object('ok', false, 'code', 'no_attempts', 'attempts_left', 0);
  end if;

  -- 같은 IP 해시: 새 기기 수 상한, 전체 도전 상한
  if v_used = 0 then
    select count(distinct device_id) into v_n from public.bun_scores
     where game_id = p_game and play_date = v_today and ip_hash = p_ip_hash;
    if v_n >= public.bun_cfg_num('limit.devices_per_ip_game_day', 30) then
      return jsonb_build_object('ok', false, 'code', 'rate_limited');
    end if;
  end if;
  select count(*) into v_n from public.bun_scores
   where game_id = p_game and play_date = v_today and ip_hash = p_ip_hash;
  if v_n >= public.bun_cfg_num('limit.ip_attempts_per_game_day', 300) then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  -- 모든 제한을 통과한 뒤에만 새 기기 프로필 생성 (거절된 요청이 프로필을 쌓지 않게)
  if v_new then
    v_prof := public.bun_set_profile(p_device, p_nickname, p_region);
    if not (v_prof ->> 'ok')::boolean then return v_prof; end if;
    select * into v_player from public.bun_players where device_id = p_device;
  end if;

  insert into public.bun_scores (game_id, play_date, device_id, attempt_no, region, ip_hash)
  values (p_game, v_today, p_device, v_used + 1, v_player.region, p_ip_hash)
  returning id into v_id;
  update public.bun_players set last_seen_at = now() where device_id = p_device;

  return jsonb_build_object('ok', true, 'attempt_id', v_id, 'attempt_no', v_used + 1,
                            'attempts_left', g.daily_attempts - v_used - 1, 'play_date', v_today);
end $$;

-- 8-3. 점수 제출 (API 라우트가 게임별 재계산 검증을 통과한 점수만 넘김)
create or replace function public.bun_submit_score(
  p_attempt_id bigint, p_device uuid, p_score numeric, p_elapsed numeric, p_meta jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s          public.bun_scores%rowtype;
  g          public.bun_games%rowtype;
  v_score    numeric;
  v_status   text := 'submitted';
  v_reason   text;
  v_srv      numeric;
  v_prev     public.bun_best%rowtype;
  v_hasprev  boolean;
  v_prevrank integer;
  v_improved boolean := false;
  v_best     public.bun_best%rowtype;
  v_rank     integer;
  v_n        integer;
  v_left     integer;
begin
  select * into s from public.bun_scores where id = p_attempt_id for update;
  if not found or s.device_id is distinct from p_device then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if s.status <> 'started' then return jsonb_build_object('ok', false, 'code', 'already_submitted'); end if;
  select * into g from public.bun_games where game_id = s.game_id;

  perform public.bun_lock(s.game_id::text || ':' || s.device_id::text || ':' || s.play_date::text);

  if not public.bun_enabled('scores') then return jsonb_build_object('ok', false, 'code', 'disabled'); end if;
  -- 자정(KST)이 지나면 전날 도전은 제출 불가. 시간 초과도 불가
  if s.play_date <> public.bun_today()
     or now() - s.started_at > make_interval(mins => public.bun_cfg_num('limit.attempt_ttl_minutes', 60)::int) then
    update public.bun_scores set status = 'expired' where id = s.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if p_score is null or p_score < g.min_score or p_score > g.max_score then
    update public.bun_scores set status = 'rejected', submitted_at = now(), flag_reason = 'out_of_range' where id = s.id;
    return jsonb_build_object('ok', false, 'code', 'invalid_score');
  end if;

  v_score := round(p_score, g.score_scale);
  v_srv := extract(epoch from (now() - s.started_at));
  if g.elapsed_check and (p_elapsed is null or abs(v_srv - p_elapsed) > g.elapsed_tolerance_s) then
    v_status := 'flagged';
    v_reason := format('elapsed_mismatch client=%s server=%s', p_elapsed, round(v_srv, 3));
  elsif g.review_at is not null
        and ((g.better = 'high' and v_score >= g.review_at) or (g.better = 'low' and v_score <= g.review_at)) then
    v_status := 'flagged';
    v_reason := 'human_limit';
  end if;

  update public.bun_scores
     set status = v_status, submitted_at = now(), score = v_score, elapsed_s = p_elapsed, meta = p_meta, flag_reason = v_reason
   where id = s.id;

  select greatest(g.daily_attempts - count(*), 0) into v_left from public.bun_scores
   where game_id = s.game_id and play_date = s.play_date and device_id = s.device_id;

  if v_status = 'flagged' then
    return jsonb_build_object('ok', true, 'status', 'review', 'score', v_score, 'attempts_left', v_left);
  end if;

  select * into v_prev from public.bun_best
   where game_id = s.game_id and play_date = s.play_date and device_id = s.device_id;
  v_hasprev := found;
  if v_hasprev then v_prevrank := public.bun_rank_of(s.game_id, s.play_date, v_prev.sort_key, v_prev.achieved_at); end if;

  if not v_hasprev or public.bun_sort_key(g.better, v_score) < v_prev.sort_key then
    v_improved := true;
    insert into public.bun_best (game_id, play_date, device_id, best_score, sort_key, achieved_at, score_id)
    values (s.game_id, s.play_date, s.device_id, v_score, public.bun_sort_key(g.better, v_score), now(), s.id)
    on conflict (game_id, play_date, device_id) do update
      set best_score = excluded.best_score, sort_key = excluded.sort_key,
          achieved_at = excluded.achieved_at, score_id = excluded.score_id;
  end if;

  select * into v_best from public.bun_best
   where game_id = s.game_id and play_date = s.play_date and device_id = s.device_id;
  v_rank := public.bun_rank_of(s.game_id, s.play_date, v_best.sort_key, v_best.achieved_at);
  select count(*) into v_n from public.bun_best where game_id = s.game_id and play_date = s.play_date;

  return jsonb_build_object(
    'ok', true, 'status', 'ranked', 'score', v_score, 'improved', v_improved,
    'best', v_best.best_score, 'rank', v_rank,
    'prev_rank', case when v_improved and v_hasprev then v_prevrank end,
    'participants', v_n, 'pct', public.bun_pct(v_rank, v_n),
    'attempts_left', v_left);
end $$;

-- 8-4. 내 순위 (캐시 안 함. 결과 직후와 60초 간격 확인용)
create or replace function public.bun_my_board(p_game smallint, p_device uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  g      public.bun_games%rowtype;
  v_day  date := public.bun_today();
  v_p    public.bun_players%rowtype;
  b      public.bun_best%rowtype;
  v_used integer;
  v_wp   integer;
  v_wd   integer;
  v_rank integer;
  v_n    integer;
  v_up   jsonb;
  v_down jsonb;
  v_base jsonb;
begin
  select * into g from public.bun_games where game_id = p_game;
  if not found then return jsonb_build_object('ok', false, 'code', 'bad_game'); end if;
  select * into v_p from public.bun_players where device_id = p_device;
  select count(*) into v_used from public.bun_scores where game_id = p_game and play_date = v_day and device_id = p_device;
  select coalesce(sum(points), 0)::int, count(*)::int into v_wp, v_wd
    from public.bun_daily_points
   where game_id = p_game and device_id = p_device and play_date >= public.bun_week_start() and play_date < v_day;

  v_base := jsonb_build_object(
    'ok', true, 'play_date', v_day, 'enabled', public.bun_enabled('scores') and g.is_active,
    'nickname', v_p.nickname, 'region', v_p.region, 'blocked', coalesce(v_p.banned, false),
    'attempts_used', v_used, 'attempts_left', greatest(g.daily_attempts - v_used, 0),
    'week_points', v_wp, 'week_days', v_wd);

  select * into b from public.bun_best where game_id = p_game and play_date = v_day and device_id = p_device;
  if not found then return v_base || jsonb_build_object('has_record', false); end if;

  v_rank := public.bun_rank_of(p_game, v_day, b.sort_key, b.achieved_at);
  select count(*) into v_n from public.bun_best where game_id = p_game and play_date = v_day;

  select coalesce(jsonb_agg(jsonb_build_object('rank', v_rank - q.rn, 'nickname', q.nickname, 'region', q.region, 'score', q.best_score)
                            order by q.rn desc), '[]'::jsonb)
    into v_up
    from (select row_number() over (order by t.sort_key desc, t.achieved_at desc) rn, t.*
            from (select bb.sort_key, bb.achieved_at, bb.best_score, p.nickname, s.region
                    from public.bun_best bb
                    join public.bun_players p on p.device_id = bb.device_id
                    join public.bun_scores s on s.id = bb.score_id
                   where bb.game_id = p_game and bb.play_date = v_day
                     and (bb.sort_key, bb.achieved_at) < (b.sort_key, b.achieved_at)
                   order by bb.sort_key desc, bb.achieved_at desc
                   limit 3) t) q;

  select coalesce(jsonb_agg(jsonb_build_object('rank', v_rank + q.rn, 'nickname', q.nickname, 'region', q.region, 'score', q.best_score)
                            order by q.rn), '[]'::jsonb)
    into v_down
    from (select row_number() over (order by t.sort_key, t.achieved_at) rn, t.*
            from (select bb.sort_key, bb.achieved_at, bb.best_score, p.nickname, s.region
                    from public.bun_best bb
                    join public.bun_players p on p.device_id = bb.device_id
                    join public.bun_scores s on s.id = bb.score_id
                   where bb.game_id = p_game and bb.play_date = v_day
                     and (bb.sort_key, bb.achieved_at) > (b.sort_key, b.achieved_at)
                   order by bb.sort_key, bb.achieved_at
                   limit 3) t) q;

  return v_base || jsonb_build_object(
    'has_record', true, 'best', b.best_score, 'rank', v_rank, 'participants', v_n,
    'pct', public.bun_pct(v_rank, v_n), 'above', v_up, 'below', v_down);
end $$;

-- 8-5. 순위표 (1분 캐시 + 주간 캐시. Vercel에서 60초 더 캐시)
--      주간: 이번 주에 마감된 날이 있으면 이번 주. 월요일에만 지난주 결과(일요일까지 반영됐으면 final)
create or replace function public.bun_get_board(p_game smallint)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  with wk as (
    select jsonb_build_object('from', w.week_start, 'through', w.through, 'top', w.top,
                              'last_week', w.week_start < public.bun_week_start(),
                              'final', w.through >= w.week_start + 6) as week
      from public.bun_week_cache w
     where w.game_id = p_game
       and (w.week_start = public.bun_week_start()
            or (w.week_start = public.bun_week_start() - 7 and public.bun_today() = public.bun_week_start()))
     order by w.week_start desc
     limit 1)
  select coalesce(
    (select c.payload || jsonb_build_object('participants', c.participants, 'computed_at', c.computed_at,
                                             'enabled', public.bun_enabled('scores') and g.is_active)
       from public.bun_rank_cache c join public.bun_games g on g.game_id = c.game_id
      where c.game_id = p_game and c.play_date = public.bun_today()),
    jsonb_build_object('game_id', p_game, 'play_date', public.bun_today(), 'participants', 0,
                       'top', '[]'::jsonb, 'cutoffs', '{}'::jsonb, 'regions', '[]'::jsonb,
                       'enabled', public.bun_enabled('scores')
                                  and coalesce((select is_active from public.bun_games where game_id = p_game), false)))
  || jsonb_build_object('week', coalesce((select week from wk),
                                         jsonb_build_object('from', public.bun_week_start(), 'top', '[]'::jsonb, 'last_week', false, 'final', false)))
$$;

-- 8-6. 홈 화면 "오늘의 1위"
create or replace function public.bun_get_champions()
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'play_date', public.bun_today(),
    'enabled', public.bun_enabled('scores'),
    'games', coalesce(jsonb_agg(jsonb_build_object(
               'game_id', g.game_id, 'slug', g.slug, 'title', g.title,
               'participants', coalesce(c.participants, 0),
               'top1', c.payload -> 'top' -> 0) order by g.game_id), '[]'::jsonb))
    from public.bun_games g
    left join public.bun_rank_cache c on c.game_id = g.game_id and c.play_date = public.bun_today()
   where g.is_active
$$;

-- ---------------------------------------------------------------------
-- 9. 예약 작업용 함수 (pg_cron 이 postgres 권한으로 실행)
-- ---------------------------------------------------------------------

-- 9-1. 순위 캐시 갱신 (매분)
create or replace function public.bun_refresh_rank_cache()
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g        record;
  v_day    date := public.bun_today();
  v_n      integer;
  v_top    jsonb;
  v_cut    jsonb;
  v_reg    jsonb;
  v_dist   jsonb;
  v_perf   integer;
begin
  for g in select * from public.bun_games where is_active loop
    select count(*) into v_n from public.bun_best where game_id = g.game_id and play_date = v_day;

    select coalesce(jsonb_agg(jsonb_build_object('rank', t.rk, 'nickname', t.nickname, 'region', t.region,
                                                 'score', t.best_score, 'achieved_at', t.achieved_at) order by t.rk), '[]'::jsonb)
      into v_top
      from (select row_number() over (order by q.sort_key, q.achieved_at) rk, q.*
              from (select b.sort_key, b.achieved_at, b.best_score, p.nickname, s.region
                      from public.bun_best b
                      join public.bun_players p on p.device_id = b.device_id
                      join public.bun_scores s on s.id = b.score_id
                     where b.game_id = g.game_id and b.play_date = v_day and not p.banned
                     order by b.sort_key, b.achieved_at
                     limit 100) q) t;

    select coalesce(jsonb_object_agg(x.k::text, x.v), '{}'::jsonb) into v_cut
      from (select k, (select b.best_score from public.bun_best b
                        where b.game_id = g.game_id and b.play_date = v_day
                        order by b.sort_key, b.achieved_at offset k - 1 limit 1) v
              from unnest(array[1, 10, 100, 1000]) k) x
     where x.v is not null;

    if g.region_source = 'all' then
      -- 반응속도: 오늘 제출된 모든 판의 시도 평균
      select coalesce(jsonb_agg(jsonb_build_object('region', r.region, 'avg', r.avg, 'count', r.cnt)
                                order by public.bun_sort_key(g.better, r.avg)), '[]'::jsonb)
        into v_reg
        from (select s.region, round(avg(s.score), g.score_scale) avg, count(*) cnt
                from public.bun_scores s join public.bun_players p on p.device_id = s.device_id
               where s.game_id = g.game_id and s.play_date = v_day and s.status = 'submitted'
                 and s.region <> '미정' and not p.banned
               group by s.region) r;
    else
      -- 나머지: 기기별 최고 기록의 시도 평균 (동네 실패 기록 제외)
      select coalesce(jsonb_agg(jsonb_build_object('region', r.region, 'avg', r.avg, 'count', r.cnt)
                                order by public.bun_sort_key(g.better, r.avg)), '[]'::jsonb)
        into v_reg
        from (select s.region, round(avg(b.best_score), g.score_scale) avg, count(*) cnt
                from public.bun_best b
                join public.bun_scores s on s.id = b.score_id
                join public.bun_players p on p.device_id = b.device_id
               where b.game_id = g.game_id and b.play_date = v_day and not p.banned
                 and s.region <> '미정'
                 and (g.slug <> 'dongne' or b.best_score < 7000)
               group by s.region) r;
    end if;

    v_dist := null;
    if g.slug = 'dongne' then
      select jsonb_agg(jsonb_build_object('tries', t.n, 'count', coalesce(d.c, 0)) order by t.n) into v_dist
        from generate_series(1, 7) t(n)
        left join (select least(floor(best_score / 1000)::int, 7) tr, count(*) c
                     from public.bun_best where game_id = g.game_id and play_date = v_day group by 1) d on d.tr = t.n;
    end if;

    v_perf := null;
    if g.slug = '10sec' then
      select count(*) into v_perf from public.bun_best where game_id = g.game_id and play_date = v_day and best_score = 0;
    end if;

    insert into public.bun_rank_cache (game_id, play_date, participants, payload, computed_at)
    values (g.game_id, v_day, v_n,
            jsonb_build_object('game_id', g.game_id, 'slug', g.slug, 'better', g.better, 'play_date', v_day,
                               'top', v_top, 'cutoffs', v_cut, 'regions', v_reg, 'dist', v_dist,
                               'perfect_count', v_perf),
            now())
    on conflict (game_id, play_date) do update
      set participants = excluded.participants, payload = excluded.payload, computed_at = excluded.computed_at;
  end loop;
end $$;

-- 9-2. 하루 마감: 상위 100명 보관, 주간 점수 적립, 주간 순위 계산, 미제출 도전 만료
--      같은 날을 두 번 처리하지 않음 (bun_rollover_log). 매시 최근 3일을 다시 확인해 실패를 따라잡음
create or replace function public.bun_daily_rollover(p_date date default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_date date := coalesce(p_date, public.bun_today() - 1);
  g      record;
  v_h    integer := 0;
  v_p    integer := 0;
  v_c    integer;
  v_res  jsonb;
begin
  if v_date >= public.bun_today() then
    return jsonb_build_object('date', v_date, 'skipped', 'not_ended');
  end if;
  if exists (select 1 from public.bun_rollover_log where play_date = v_date) then
    return jsonb_build_object('date', v_date, 'skipped', 'done');
  end if;

  update public.bun_scores set status = 'expired'
   where status = 'started'
     and (play_date < public.bun_today()
          or started_at < now() - make_interval(mins => public.bun_cfg_num('limit.attempt_ttl_minutes', 60)::int));

  for g in select * from public.bun_games loop
    insert into public.bun_rank_history (game_id, play_date, rank, device_id, nickname, region, score, achieved_at)
    select g.game_id, v_date, t.rk, t.device_id, t.nickname, t.region, t.best_score, t.achieved_at
      from (select row_number() over (order by b.sort_key, b.achieved_at) rk, b.device_id, p.nickname, s.region,
                   b.best_score, b.achieved_at
              from public.bun_best b
              join public.bun_players p on p.device_id = b.device_id
              join public.bun_scores s on s.id = b.score_id
             where b.game_id = g.game_id and b.play_date = v_date and not p.banned) t
     where t.rk <= 100
    on conflict do nothing;
    get diagnostics v_c = row_count; v_h := v_h + v_c;

    insert into public.bun_daily_points (game_id, play_date, device_id, rank, participants, points)
    select g.game_id, v_date, t.device_id, t.rk, t.n,
           greatest(0, least(100, round(100.0 * (1 - (t.rk - 1)::numeric / greatest(t.n, 1)))))::smallint
      from (select b.device_id, row_number() over (order by b.sort_key, b.achieved_at) rk, count(*) over () n
              from public.bun_best b join public.bun_players p on p.device_id = b.device_id
             where b.game_id = g.game_id and b.play_date = v_date and not p.banned) t
    on conflict do nothing;
    get diagnostics v_c = row_count; v_p := v_p + v_c;
  end loop;

  perform public.bun_refresh_week(public.bun_week_start(v_date));

  v_res := jsonb_build_object('date', v_date, 'history_rows', v_h, 'point_rows', v_p);
  insert into public.bun_rollover_log (play_date, result) values (v_date, v_res) on conflict do nothing;
  return v_res;
end $$;

-- 9-2b. 지난 날 마감 다시 하기 (검토 처리로 그날 순위가 바뀐 경우)
create or replace function public.bun_redo_rollover(p_date date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_date >= public.bun_today() or p_date < public.bun_today() - 30 then
    return jsonb_build_object('date', p_date, 'skipped', 'out_of_range');
  end if;
  if not exists (select 1 from public.bun_rollover_log where play_date = p_date) then
    return jsonb_build_object('date', p_date, 'skipped', 'not_rolled_yet');
  end if;
  delete from public.bun_rank_history where play_date = p_date;
  delete from public.bun_daily_points where play_date = p_date;
  delete from public.bun_rollover_log where play_date = p_date;
  return public.bun_daily_rollover(p_date);
end $$;

-- 9-3. 보관 기간 정리 (매일 00:20 KST). 점수는 30일
create or replace function public.bun_retention()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_day date := public.bun_today();
  a integer; b integer; c integer; d integer; e integer; m integer;
begin
  delete from public.bun_best   where play_date < v_day - public.bun_cfg_num('retention.scores_days', 30)::int;  get diagnostics a = row_count;
  delete from public.bun_scores where play_date < v_day - public.bun_cfg_num('retention.scores_days', 30)::int;  get diagnostics b = row_count;
  -- 공용 디스크 보호: 최고 기록·검토 대상이 아닌 도전의 meta(그린 점 좌표 등)는 이틀 뒤 비움
  update public.bun_scores s set meta = null
   where s.play_date < v_day - public.bun_cfg_num('retention.meta_days', 2)::int
     and s.meta is not null and s.status <> 'flagged'
     and not exists (select 1 from public.bun_best x where x.score_id = s.id);
  get diagnostics m = row_count;
  delete from public.bun_daily_points where play_date < v_day - public.bun_cfg_num('retention.points_days', 60)::int; get diagnostics c = row_count;
  delete from public.bun_rank_history where play_date < v_day - public.bun_cfg_num('retention.history_days', 400)::int; get diagnostics d = row_count;
  delete from public.bun_rank_cache   where play_date < v_day - 2;
  delete from public.bun_week_cache   where week_start < v_day - 21;
  delete from public.bun_rollover_log where play_date < v_day - 60;
  delete from public.bun_alerts       where created_at < now() - interval '90 days';
  delete from public.bun_players p
   where p.last_seen_at < now() - make_interval(days => public.bun_cfg_num('retention.players_days', 90)::int)
     and p.updated_at   < now() - make_interval(days => public.bun_cfg_num('retention.players_days', 90)::int)
     and not p.banned;
  get diagnostics e = row_count;
  return jsonb_build_object('best', a, 'scores', b, 'meta_cleared', m, 'points', c, 'history', d, 'players', e);
end $$;

-- 9-4. 감시 (매분): DB 전체 용량 경고·차단, 접속 폭주 시 회로 차단기
create or replace function public.bun_guard()
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_gb   numeric := pg_database_size(current_database()) / 1073741824.0;
  v_warn numeric := public.bun_cfg_num('guard.db_warn_gb', 5);
  v_kill numeric := public.bun_cfg_num('guard.db_kill_gb', 7);
  v_ips  integer;
begin
  if v_gb >= v_kill then
    if exists (select 1 from public.bun_config where key = 'switch.scores' and value = 'true'::jsonb) then
      update public.bun_config set value = 'false'::jsonb, updated_at = now(),
             note = format('bun_guard 자동 차단: DB %s GB', round(v_gb, 2))
       where key = 'switch.scores';
      insert into public.bun_alerts (level, code, message)
      values ('kill', 'db_kill', format('DB %s GB, 기준 %s GB 초과. 점수 기능을 껐습니다', round(v_gb, 2), v_kill));
    end if;
  elsif v_gb >= v_warn
        and not exists (select 1 from public.bun_alerts where code = 'db_warn' and created_at > now() - interval '1 day') then
    insert into public.bun_alerts (level, code, message)
    values ('warn', 'db_warn', format('DB %s GB, 경고 기준 %s GB 초과', round(v_gb, 2), v_warn));
  end if;
  -- 회로 차단기: 최근 1분에 서로 다른 IP 해시가 상한을 넘으면 일시정지 (한 곳의 몰아치기는 IP별 제한이 먼저 막음)
  select count(distinct ip_hash) into v_ips from public.bun_scores where started_at > now() - interval '1 minute';
  if v_ips >= public.bun_cfg_num('limit.ips_per_min', 1500) and public.bun_enabled('scores') then
    perform public.bun_pause('scores', public.bun_cfg_num('limit.pause_minutes', 10)::int, format('circuit_breaker: %s ips/min', v_ips));
  end if;
  return jsonb_build_object('db_gb', round(v_gb, 3), 'warn_gb', v_warn, 'kill_gb', v_kill, 'ips_last_min', v_ips);
end $$;

-- ---------------------------------------------------------------------
-- 10. 운영자 함수 (SQL Editor 에서 postgres 로 실행)
-- ---------------------------------------------------------------------
create or replace function public.bun_set_switch(p_feature text, p_on boolean)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.bun_config (key, value, note) values ('switch.' || p_feature, to_jsonb(p_on), 'bun_set_switch')
  on conflict (key) do update set value = excluded.value, note = excluded.note, updated_at = now();
  if p_on then
    update public.bun_config set value = 'null'::jsonb, updated_at = now() where key = 'paused_until.' || p_feature;
  end if;
  insert into public.bun_alerts (level, code, message)
  values ('info', 'switch_' || p_feature, format('%s 스위치를 %s', p_feature, case when p_on then '켬' else '끔' end));
end $$;

create or replace function public.bun_flag_score(p_score_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare s public.bun_scores%rowtype;
begin
  update public.bun_scores set status = 'flagged', flag_reason = coalesce(p_reason, 'manual')
   where id = p_score_id and score is not null returning * into s;
  if found then
    perform public.bun_recompute_best(s.game_id, s.play_date, s.device_id);
    if s.play_date < public.bun_today() then perform public.bun_redo_rollover(s.play_date); end if;
  end if;
end $$;

-- 검토 통과 (자동 검토 human_limit, elapsed_mismatch 포함)
create or replace function public.bun_unflag_score(p_score_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare s public.bun_scores%rowtype;
begin
  update public.bun_scores set status = 'submitted', flag_reason = null
   where id = p_score_id and status = 'flagged' and score is not null returning * into s;
  if found then
    perform public.bun_recompute_best(s.game_id, s.play_date, s.device_id);
    if s.play_date < public.bun_today() then perform public.bun_redo_rollover(s.play_date); end if;
  end if;
end $$;

create or replace function public.bun_ban_device(p_device uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.bun_players set banned = true, ban_reason = p_reason, updated_at = now() where device_id = p_device;
  delete from public.bun_best where device_id = p_device;
end $$;

-- 이용자 삭제 요청 처리: 기기의 모든 기록 삭제, 명예의 전당에 남은 별명은 가림
create or replace function public.bun_forget_device(p_device uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer; v_deleted boolean;
begin
  update public.bun_rank_history set nickname = '(삭제됨)', device_id = null where device_id = p_device;
  get diagnostics n = row_count;
  delete from public.bun_players where device_id = p_device;   -- scores, best, points 는 cascade
  v_deleted := found;
  delete from public.bun_week_cache where week_start >= public.bun_week_start() - 7;
  perform public.bun_refresh_week(public.bun_week_start());
  perform public.bun_refresh_week(public.bun_week_start() - 7);
  return jsonb_build_object('history_masked', n, 'deleted', v_deleted);
end $$;

-- 점검용 뷰 (호출자 권한으로 실행. anon 에는 열지 않음)
create or replace view public.bun_v_top_today with (security_invoker = true) as
select g.slug, r.rank, p.nickname, s.region, b.best_score, s.elapsed_s, s.meta, s.id as score_id, b.device_id,
       (select count(*) from public.bun_scores x
         where x.game_id = s.game_id and x.play_date = s.play_date and x.ip_hash = s.ip_hash) as ip_attempts_today
  from public.bun_best b
  join public.bun_games g on g.game_id = b.game_id
  join public.bun_players p on p.device_id = b.device_id
  join public.bun_scores s on s.id = b.score_id
  cross join lateral (select public.bun_rank_of(b.game_id, b.play_date, b.sort_key, b.achieved_at) as rank) r
 where b.play_date = public.bun_today() and r.rank <= 100;

create or replace view public.bun_v_flagged with (security_invoker = true) as
select s.id as score_id, g.slug, s.play_date, p.nickname, s.region, s.score, s.elapsed_s, s.flag_reason, s.submitted_at, s.device_id
  from public.bun_scores s
  join public.bun_games g on g.game_id = s.game_id
  join public.bun_players p on p.device_id = s.device_id
 where s.status = 'flagged' and s.play_date >= public.bun_today() - 2;

-- ---------------------------------------------------------------------
-- 11. 권한: anon/authenticated 차단, bun_app 은 API 함수 실행만
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  -- 테이블·뷰·시퀀스: RLS 켜고(정책 없음) 모든 권한 회수
  for r in select c.oid::regclass as t, c.relkind
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname like 'bun\_%' and c.relkind in ('r', 'v', 'S') loop
    if r.relkind = 'r' then execute format('alter table %s enable row level security', r.t); end if;
    execute format('revoke all on %s from public', r.t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on %s from anon', r.t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on %s from authenticated', r.t); end if;
    execute format('revoke all on %s from bun_app', r.t);
  end loop;
  -- 함수: 기본 실행 권한(PUBLIC, anon, authenticated) 회수
  for r in select p.oid::regprocedure as f
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'bun\_%' loop
    execute format('revoke all on function %s from public', r.f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', r.f); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', r.f); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('revoke all on function %s from service_role', r.f); end if;
  end loop;
end $$;

grant execute on function public.bun_set_profile(uuid, text, text)                       to bun_app;
grant execute on function public.bun_start_attempt(smallint, uuid, text, text, text)     to bun_app;
grant execute on function public.bun_submit_score(bigint, uuid, numeric, numeric, jsonb) to bun_app;
grant execute on function public.bun_my_board(smallint, uuid)                            to bun_app;
grant execute on function public.bun_get_board(smallint)                                 to bun_app;
grant execute on function public.bun_get_champions()                                     to bun_app;
