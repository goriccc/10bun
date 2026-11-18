-- 오늘의 슬라이드 퍼즐 (game 15) 등록. 부록 B 다음에 적용. 처음에는 꺼진 상태(is_active=false)
-- 운영자가 그림 일정표와 화면을 확인한 뒤: update bun_games set is_active = true where game_id = 15;
insert into public.bun_games
  (game_id, slug, title, better, daily_attempts, min_score, max_score, score_scale,
   elapsed_check, elapsed_tolerance_s, review_at, region_source, is_active)
values
  (15, 'puzzle', '오늘의 슬라이드 퍼즐', 'low', 1, 1, 3600, 2, true, 5, 3, 'best', false)
on conflict (game_id) do update set
  slug = excluded.slug, title = excluded.title, better = excluded.better,
  daily_attempts = excluded.daily_attempts, min_score = excluded.min_score, max_score = excluded.max_score,
  score_scale = excluded.score_scale, elapsed_check = excluded.elapsed_check,
  elapsed_tolerance_s = excluded.elapsed_tolerance_s, review_at = excluded.review_at,
  region_source = excluded.region_source;
-- is_active 는 다시 실행해도 덮어쓰지 않음
