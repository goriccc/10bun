-- =====================================================================
-- 3단계 나머지 예약 작업
-- 선행: 20261115000002 ~ 00005 실행, pg_cron 활성화
-- 시각은 UTC. 25 15 * * * = 매일 00:25 KST
-- =====================================================================
select cron.schedule('bun_close_picks', '*/5 * * * *',
  $$set statement_timeout = '20s'; select public.bun_close_picks()$$);

select cron.schedule('bun_tick_fish', '* * * * *',
  $$set statement_timeout = '10s'; select public.bun_tick_fish()$$);

select cron.schedule('bun_phase3_retention', '25 15 * * *',
  $$set statement_timeout = '30s';
    select public.bun_purge_picks();
    select public.bun_purge_fish_feeds();
    select public.bun_purge_offwork();
    select public.bun_purge_lunch()$$);

-- 끄기: select cron.unschedule('bun_close_picks');
--       select cron.unschedule('bun_tick_fish');
--       select cron.unschedule('bun_phase3_retention');
