# 10분닷컴

매일 0시(한국 시간)에 바뀌는 작은 놀이 사이트입니다. 브라우저는 데이터베이스에 직접 접속하지 않고, 서버가 `bun_app` 역할로 `bun_` 함수만 호출합니다.

## 로컬 실행

개발 데이터베이스는 Supabase 프로젝트 `10bun-dev`입니다. Docker와 `supabase start`는 쓰지 않습니다. `supabase link`, `supabase db push`, `supabase db reset --linked`, `supabase migration repair`, `supabase db pull`도 실행하지 않습니다.

```powershell
npm run check-db -- --allow-remote
npm test
npm run dev
```

`.env.local`에 두는 이름:

| 이름 | 설명 |
|---|---|
| `BUN_DATABASE_URL` | 개발 프로젝트의 트랜잭션 풀러 주소. 사용자는 `bun_app.<project_ref>` |
| `BUN_IP_SALT` | 32자 이상 무작위 |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | `ca-pub-...`. 확인 전에는 비움 |
| `NEXT_PUBLIC_GA_ID` | `G-...`. 확인 전에는 비움 |
| `NEXT_PUBLIC_SITE_URL` | `https://10bun.com` |

운영 `BUN_DATABASE_URL`은 Vercel Production에만 넣습니다. Preview와 Development에는 넣지 않습니다. `service_role` 키는 쓰지 않습니다.

## 운영자가 나중에 직접 할 일

- 운영 데이터베이스 SQL, DNS, 도메인 연결. 워드프레스에서 이 사이트로 옮기는 것이 맞음
- 데이터베이스와 Vercel 함수 지역은 싱가포르(`sin1`). 운영 Postgres는 17
- 개인정보 보호책임자는 멀티파이프(대표 송준호), contact@10bun.com
- 애드센스 자동 광고 끄기, 유럽·영국 방문자용 동의 도구 켜기
- 워드프레스 시절 주소 목록. 같은 주제만 301, 나머지는 410
- 새 사이트를 배포한 뒤 DNS를 바꿔 `ads.txt`가 끊기지 않게 하기

## 운영자 점검 SQL

```sql
-- 서버 기능 끄기 / 켜기 (게임은 연습 모드로 계속 동작)
select bun_set_switch('scores', false);
select bun_set_switch('scores', true);

-- 오늘 상위 기록과 의심 신호 (경과 시간, 같은 IP 해시 도전 수)
select * from bun_v_top_today order by slug, rank limit 50;

-- 자동 검토 대기 (human_limit: 사람 한계에 가까운 기록, elapsed_mismatch: 시간 불일치). 매일 확인
select * from bun_v_flagged order by submitted_at desc;

-- 일괄 통과 예시: 오늘 ±0.000초(10sec) 중 시간 불일치가 아닌 것
select bun_unflag_score(score_id) from bun_v_flagged where slug = '10sec' and flag_reason = 'human_limit';

-- 기록 처리 (지난 날짜의 기록을 처리하면 그날의 명예의 전당·주간 점수도 자동으로 다시 계산됨)
select bun_unflag_score(<score_id>);         -- 검토 통과 → 순위에 반영
select bun_flag_score(<score_id>, '사유');   -- 순위에서 빼기
select bun_ban_device('<device_id>', '사유'); -- 기기 차단
select bun_forget_device('<device_id>');     -- 이용자 삭제 요청 처리

-- 알림과 용량
select * from bun_alerts order by id desc limit 20;
select bun_guard();

-- 예약 작업 상태
select jobname, schedule, active from cron.job where jobname like 'bun\_%';
```

운영 기준(결제 주기 기준): 전송량 150GB에서 대시보드 확인, 220GB에 가까우면 `bun_set_switch('scores', false)`. DB 용량 5GB 경고, 7GB 자동 차단(`bun_guard`. 같은 데이터베이스 전체 용량 기준). 같은 IP는 게임별로 1분에 도전 시작 20번, 하루 기기 30대까지. 최근 1분에 서로 다른 IP가 1,500곳을 넘으면 10분 자동 일시정지.
"# 10bun" 
