-- =====================================================================
-- 18 친구 대결방 만료 삭제
-- 선행: 20261115000001_bun_rooms.sql 실행, pg_cron 활성화
-- Supabase 의 pg_cron 은 UTC 기준. 30 15 * * * = 매일 00:30 KST
-- =====================================================================
select cron.schedule('bun_purge_rooms', '30 15 * * *',
  $$set statement_timeout = '20s'; select public.bun_purge_rooms()$$);

-- 확인: select jobname, schedule, active from cron.job where jobname = 'bun_purge_rooms';
-- 끄기: select cron.unschedule('bun_purge_rooms');
