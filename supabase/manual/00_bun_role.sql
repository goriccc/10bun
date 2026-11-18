-- =====================================================================
-- 10분닷컴 00. 전용 DB 역할에 로그인 비밀번호 부여 (운영자가 수동 1회 실행)
-- 실행 위치: 퀴즈오아시스 Supabase 대시보드 > SQL Editor (01 실행 후)
-- 비밀번호는 32자 이상 무작위 문자열로 바꾼 뒤 실행.
-- 실행 후 SQL Editor 의 이 스니펫을 삭제하거나, psql 의 \password bun_app 으로 설정해 기록을 남기지 않는다.
-- 저장소에는 비밀번호 자리표시만 커밋한다.
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bun_app') then
    create role bun_app nologin noinherit;
  end if;
end $$;

alter role bun_app with login password '90e345bfecaf85350c6717bb4d6996da0481474db615012b8590597825a5baa7';
alter role bun_app connection limit 20;                        -- Micro 직접 연결 60개 중 최대 20개만
alter role bun_app set statement_timeout = '3s';               -- 느린 쿼리가 퀴즈오아시스를 막지 않게
alter role bun_app set idle_in_transaction_session_timeout = '10s';
