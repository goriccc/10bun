-- 순위 게임 켜기 (퀴즈오아시스 SQL Editor, postgres 역할)
-- 4·5: 2단계 추정 게임 / 15: 슬라이드 퍼즐(버킷 그림 준비된 뒤)
update public.bun_games
   set is_active = true
 where game_id in (4, 5, 15);
