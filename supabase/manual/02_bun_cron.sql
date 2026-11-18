-- =====================================================================
-- 10분닷컴 02. 예약 작업 (pg_cron)
-- 선행: 대시보드 > Integrations > Cron 에서 pg_cron 활성화, 01 실행 완료
--       (로컬: create extension if not exists pg_cron;)
-- Supabase 의 pg_cron 은 UTC 기준. KST = UTC + 9
-- 같은 이름으로 다시 실행하면 일정이 갱신됨
-- 시간 제한은 함수 안이 아니라 여기서 건다 (함수 안의 set local 은 이미 실행 중인 문장에 적용되지 않음)
-- 적용 확인(1회): select cron.schedule('bun_timeout_test','* * * * *',$$set statement_timeout='1s'; select pg_sleep(3)$$);
--   1~2분 뒤 cron.job_run_details 에서 실패(취소)를 확인하고 select cron.unschedule('bun_timeout_test');
-- =====================================================================
select cron.schedule('bun_refresh_rank_cache', '* * * * *',
  $$set statement_timeout = '20s'; select public.bun_refresh_rank_cache()$$);                                   -- 매분

select cron.schedule('bun_daily_rollover', '5 * * * *',
  $$set statement_timeout = '60s';
    select public.bun_daily_rollover(d::date)
      from generate_series(public.bun_today() - 3, public.bun_today() - 1, interval '1 day') d$$);
  -- 매시 5분. 이미 마감한 날은 건너뜀. 한 번 실패해도 다음 시간에 다시 처리 (최근 3일)

select cron.schedule('bun_retention', '20 15 * * *',
  $$set statement_timeout = '60s'; select public.bun_retention()$$);                                            -- 매일 00:20 KST

select cron.schedule('bun_guard', '* * * * *',
  $$set statement_timeout = '10s'; select public.bun_guard()$$);                  -- 매분 (용량 감시 + 회로 차단기)

select cron.schedule('bun_cron_log_cleanup', '40 15 * * *',
  $$delete from cron.job_run_details d using cron.job j
     where d.jobid = j.jobid and j.jobname like 'bun\_%' and d.end_time < now() - interval '3 days'$$);
  -- 매일 00:40 KST. 공용 DB에 실행 기록이 쌓이지 않게

-- 확인: select jobname, schedule, active from cron.job where jobname like 'bun\_%';
-- 실행 기록: select j.jobname, d.status, d.start_time, d.return_message
--              from cron.job_run_details d join cron.job j using (jobid)
--             where j.jobname like 'bun\_%' order by d.start_time desc limit 20;
-- 끄기: select cron.unschedule('bun_refresh_rank_cache');
