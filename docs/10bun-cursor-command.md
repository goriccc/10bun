# 10분닷컴 개발 명령서 (Cursor용) v1.3

작성일 2026-11-14, v1.3 수정 2026-11-18 (15번을 오늘의 슬라이드 퍼즐로 교체, 모든 서비스 상세 화면에 공유하기 추가). 이 문서 하나로 10분닷컴(10bun.com) 실서비스를 만든다. 디자인과 동작의 기준은 `reference/10bun-mockup.html`(목업), 데이터베이스는 부록 A~C(2단계에서 D)의 SQL이다.

---

## 0. Cursor에게: 작업 방식

1. 이 문서를 끝까지 읽은 뒤 시작한다. 단계(Phase)는 순서대로 진행하고, 각 단계 끝의 **체크포인트**에서 멈춰 결과를 보고한 뒤 승인을 받고 다음 단계로 간다.
2. 부록 A~C의 SQL(부록 D는 2단계)은 Postgres 16(PGlite, 슈퍼유저)에서 84개 시나리오로 검증했고, 독립 검토자가 두 차례 점검했다. Supabase 고유의 기본 권한, 풀러, 실제 부하는 검증하지 못했으므로 7절 점검을 반드시 수행한다. **함수 이름, 인자, 반환 형식을 바꾸지 않는다.** 바꿔야 할 이유가 있으면 먼저 보고한다.
3. 목업의 가짜 데이터(가상 참여자, 가상 순위, 시뮬레이션)는 실서비스에 넣지 않는다. 실제 값이 없으면 빈 상태 화면을 보여 준다.
4. 가격, 지명, 날씨 같은 사실 데이터는 지어내지 않는다. 데이터 파일이 비어 있으면 그 게임을 비활성으로 두고 보고한다.
5. 모르는 것은 추측하지 말고 `TODO(운영자 확인)` 주석과 함께 보고 목록에 올린다.
6. 사용자에게 보이는 문구는 모두 한국어, 존댓말 "~요"체, 짧은 문장.
7. **퀴즈오아시스 운영 DB를 건드리는 명령은 절대 실행하지 않는다** (13절 첫 항목). 운영 SQL은 운영자가 SQL Editor에서 직접 실행한다.

---

## 1. 확정된 결정

| 항목 | 결정 |
|---|---|
| 서버 | 퀴즈오아시스 Supabase 프로젝트를 같이 쓴다 (Pro, Micro 컴퓨트). 추가 프로젝트 없음 |
| 이름 구분 | 10분닷컴의 모든 DB 객체는 `bun_` 접두어 (테이블, 함수, 뷰, 크론 작업). 숫자로 시작하는 `10bun_`은 쓰지 않는다 |
| DB 접근 | 브라우저는 DB에 직접 접근하지 않는다. Next.js 서버 라우트가 전용 역할 `bun_app`으로 `bun_` 함수만 호출한다 |
| 로그인 | 없음. 브라우저가 만든 기기 ID(UUID)와 별명·시도로 순위에 참여. 시도는 고르기 전까지 '미정'(시도 대항 집계 제외) |
| 날짜 기준 | 한국 시간(Asia/Seoul). 매일 0시(KST)에 새 문제, 새 순위 |
| 점수 보관 | 30일. 일별 상위 100명 기록만 400일 보관 |
| 실시간 | Supabase Realtime 쓰지 않음. 캐시된 조회로 대신한다 |
| 광고 | 애드센스 수동 광고 단위만. 자동 광고 끔 |

**운영자 확인 필요 (작업 시작 전 질문할 것)**
- 기존 10bun.com은 워드프레스다. 새 Next.js 프로젝트로 도메인을 옮긴다는 전제로 작성했다. 다른 계획이면 1단계 전에 알려 달라고 질문한다.
- 개인정보처리방침에 들어갈 운영자 이름, 연락 이메일.
- 애드센스 게시자 ID(`ca-pub-...`), GA4 측정 ID.

---

## 2. 기술 스택과 저장소 구조

- Next.js 15 (App Router) + TypeScript strict, Vercel 배포
- 스타일: 목업 CSS를 `app/globals.css`(디자인 토큰, 공통 컴포넌트)와 CSS Modules(게임별)로 옮긴다. Tailwind, UI 라이브러리 쓰지 않는다
- 폰트: `next/font/google`로 Do Hyeon, IBM Plex Sans KR을 자체 호스팅 (외부 폰트 요청 없음)
- DB 클라이언트: `postgres`(porsager) 패키지, 서버 코드에서만
- 검증: `zod`
- 테스트: `vitest`(단위), `@playwright/test`(화면 흐름)
- 로컬 개발 DB: Supabase CLI(`supabase start`)로 로컬 Postgres를 띄우고 부록 A~C를 적용한다. **개발과 테스트 중에는 운영 DB(퀴즈오아시스)에 접속하지 않는다**

```
10bun-web/
  reference/10bun-mockup.html      # 목업 원본 (수정 금지)
  reference/puzzle.ref.mjs         # (2단계) 슬라이드 퍼즐 생성·검증 기준 구현
  reference/puzzle.test.mjs        # (2단계) 위 구현의 365일 점검
  supabase/
    migrations/20261114000001_bun_core.sql   # 부록 B (bun_app 역할을 로그인 불가로 생성). 예전 버전 위에는 적용 불가
    manual/00_bun_role.sql         # 부록 A. B 다음에 실행해 비밀번호 부여. 실제 비밀번호는 커밋 금지
    manual/02_bun_cron.sql         # 부록 C (pg_cron 활성화 후 수동 실행)
    migrations/20261118000001_bun_game15.sql  # 부록 D (2단계, 15번 게임 등록. 비활성 상태로 생성)
  app/
    layout.tsx  page.tsx (홈)  [slug]/page.tsx (서비스 상세)
    about/  privacy/  terms/  contact/
    api/bun/board/[gameId]/route.ts   api/bun/me/[gameId]/route.ts
    api/bun/start/route.ts   api/bun/submit/route.ts   api/bun/profile/route.ts
    api/bun/champions/route.ts
    sitemap.ts  robots.ts
  lib/
    daily.ts        # KST 날짜, 시드, 난수 (클라이언트·서버 공용)
    games/          # 게임별 콘텐츠 생성·채점·검증 (클라이언트·서버 공용, 순수 함수)
    db.ts  ip.ts  errors.ts  device.ts  share.ts  share-card.ts  analytics.ts
  components/       # Gadget 카드, Machine, RankBoard, Champions, Toast, ShareBar, ShareSheet, AdSlot ...
  content/          # 서비스 목록, 게임 설명 문구, (2단계) 가격 데이터, puzzle-schedule.json
  public/ads.txt
  public/puzzle/    # (2단계) 슬라이드 퍼즐 그림. 파일 이름은 추측할 수 없게
```

### 환경 변수

| 이름 | 위치 | 설명 |
|---|---|---|
| `BUN_DATABASE_URL` | 서버 전용, **Vercel Production 환경에만** | Supabase 공유 풀러(Supavisor) 트랜잭션 모드 주소, 사용자 `bun_app.<project_ref>` (7절). Preview·Development 환경에는 넣지 않는다 (미리보기 배포가 운영 DB에 쓰지 않게. 값이 없으면 연습 모드로 동작) |
| `BUN_IP_SALT` | 서버 전용 | 32자 이상 무작위. IP 해시용 |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | 공개 | `ca-pub-...` |
| `NEXT_PUBLIC_GA_ID` | 공개 | `G-...` |
| `NEXT_PUBLIC_SITE_URL` | 공개 | `https://10bun.com` |

`NEXT_PUBLIC_`이 붙은 변수에 DB 정보나 비밀값을 넣지 않는다.

로컬 `.env.local`의 `BUN_DATABASE_URL`은 `postgresql://bun_app:<로컬 비밀번호>@127.0.0.1:54322/postgres`.

**Vercel 함수 지역**: 퀴즈오아시스 Supabase 프로젝트의 지역(대시보드 Settings > General)과 같은 Vercel 지역으로 고정한다 (예: 서울 ap-northeast-2 → `icn1`). `vercel.json`의 `regions` 또는 라우트의 `preferredRegion`. 기본 지역(미국 동부)이면 왕복 지연 때문에 경과 시간 검사가 정직한 사용자를 검토로 보낸다.

---

## 3. 단계별 범위

| 단계 | 내용 | 체크포인트 |
|---|---|---|
| 0 | 저장소, 디자인 시스템 이식, 공통 레이아웃, 법적 페이지, 로컬 DB에 부록 A~C 적용, API 라우트 6개 | API 단위 테스트 통과, 로컬에서 시작→제출→순위 조회 성공 |
| 1 | 홈(오늘의 세트, 오늘의 1위, 서비스 선반), 게임 1·2·3·6·17 + 전국 순위, 게임 8(오늘 번 돈), 애드센스, GA4, **모든 서비스 상세 화면의 공유하기(6-5)** | 5절 완료 기준 전부 통과 후 운영 DB 적용 승인 요청 |
| 2 | 게임 4(가격 데이터 필요), 5(경계 데이터 필요), 7(날씨 API 필요), 9(점심 거부권 링크), 10(그림 링크), **15(오늘의 슬라이드 퍼즐, 그림 필요)**, 도형 요일 과제 | 데이터·라이선스 확인 후 게임별로 진행 |
| 3 | 서버형 11~20 (18 친구 대결방부터). 서비스마다 별도 마이그레이션 | 마이그레이션 초안을 먼저 보고하고 승인 후 구현 |

아직 열지 않은 서비스는 홈 선반에 보이지 않게 한다. "준비 중" 빈 페이지를 만들지 않는다 (애드센스 "가치 없는 콘텐츠" 위험).

---

## 4. 목업에서 실서비스로 바뀌어야 하는 것 (필수)

목업은 기획 검토용이다. 아래 항목은 그대로 옮기면 안 된다.

1. **오른쪽 "사용설명서" 패널은 기획 노트다. 실서비스에서 삭제**하고, 같은 자리에 사용자용 "하는 법 / 규칙 / 자주 묻는 질문"을 넣는다 (문구는 10절 끝). 이 글이 애드센스 심사에서 페이지의 본문 역할을 한다.
2. **가짜 데이터 제거**: `boardData`, `seedCanvas`, `RX`, `LU`, 홈 "지금 다른 사람들은" 패널의 가상 수치, "다른 참여자는 가상" 표시, `.mock` 칩 전부. 홈 실시간 패널은 실제 데이터(`/api/bun/champions`)로만 채우고, 열린 서비스가 없는 항목은 숨긴다.
3. **날짜**: 목업은 기기의 현지 날짜를 쓴다. 실서비스는 반드시 KST 날짜로 시드를 만든다 (`lib/daily.ts`). 해외 사용자도 같은 문제를 받는다.
4. **시작 화면**: 게임 6(숫자 만들기)은 목업에서 페이지를 열자마자 문제가 보이고 시간이 흐른다. 실서비스는 "시작" 버튼을 누를 때 문제를 보여 주고 그때부터 시간을 잰다. 2단계의 4·5번도 같다.
5. **도전 횟수**: 목업은 기기 저장소로 센다. 실서비스는 서버(`bun_start_attempt`)가 센다. 서버가 거절하면 연습 모드로 전환한다.
6. **광고 자리**: 점선 상자 자리에 실제 애드센스 단위. 게임 3·10·14·15의 조작 화면에는 광고를 두지 않는다 (목업 문구 그대로 정책 유지).
7. **"7일째 연속"**: 고정 문구. 실제 연속 방문일을 기기 저장소로 계산하고, 0일이면 칩을 숨긴다.
8. **공유**: 목업은 결과가 나온 뒤에만 공유 버튼이 있다. 실서비스는 **모든 서비스 상세 화면 상단에 공유하기 버튼**을 두고 결과 공유·초대 공유·이미지 저장을 지원한다 (6-5절). 링크에는 UTM을 붙인다 (9절).
9. **추월 알림**: 목업은 가짜 이름으로 알린다. 실서비스는 60초마다 내 순위를 다시 조회해 순위가 내려갔으면 "n명이 앞질렀어요. 312위 → 315위"라고만 알린다.
10. **도형 요일 과제**: 1단계는 매일 "완벽한 원" 하나만 한다. 요일 탭은 숨긴다. 목업에 있는 "정확히 5cm 선"은 웹에서 실제 길이를 잴 수 없으므로 2단계에서 다른 과제로 바꾼다.
11. **숫자 만들기 예비 문제**: 목업의 예비 퍼즐(생성 실패 시)은 풀이가 불완전하다. 생성기는 반드시 풀이가 있는 문제를 내야 하고, 날짜 1년치(365개)를 미리 생성해 보는 단위 테스트로 실패가 없음을 확인한다.
12. **부정 방지 범위**: 목업 기획 노트의 "조심할 점"에는 1단계에 없는 장치도 적혀 있다 (색을 서버에서 하나씩 받기, 너무 매끈한 선 거르기, 기계처럼 일정한 누름 간격 거르기). 1단계에서 하는 것은 서버 재계산 검증(8절), 경과 시간 검사, 사람 한계 기록 자동 검토(`review_at`), 기기·IP 제한, 운영자 점검(12절)까지다. 나머지는 2단계 보강 항목으로 보고 목록에 남긴다.

---

## 5. 1단계 완료 기준

- [ ] 360px, 390px, 768px, 1280px 폭에서 가로 스크롤 없음
- [ ] 키보드만으로 홈 → 게임 → 결과 → 공유까지 가능 (게임 1의 시작·멈춤과 게임 17의 누르기는 Space/Enter로도 동작. 게임 3은 그리기 전용이라 예외로 하고 화면에 "마우스나 손가락으로 그려요" 안내), 포커스 표시 보임, `prefers-reduced-motion` 존중
- [ ] 브라우저 콘솔 오류 0
- [ ] 게임 1·2·3·6·17: 공식 도전 → 서버 제출 → 순위 표시 → 다시 도전(가능한 게임) → 횟수 소진 후 연습 모드, 끝까지 동작
- [ ] 서버를 끈 상태(`select bun_set_switch('scores', false);`)에서 모든 게임이 연습 모드로 정상 동작하고 안내 문구가 나옴
- [ ] `/api/bun/board/*`, `/api/bun/champions` 응답에 `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`
- [ ] 운영 배포 직후 `/api/bun/board/1` 응답이 `enabled: true`
- [ ] 응답 어디에도 `device_id`, IP, IP 해시가 다른 사람에게 노출되지 않음
- [ ] 단위 테스트: 6절의 채점·검증 함수, KST 날짜 경계(23:59:59 / 00:00:00 KST), 숫자 퍼즐 365일 생성
- [ ] Playwright: 게임 1 공식 도전 1회와 게임 3 원 그리기 1회를 로컬 DB 상대로 끝까지 실행
- [ ] Lighthouse 모바일: 성능 85 이상, 접근성 95 이상
- [ ] 개인정보처리방침, 이용약관, 소개, 문의 페이지 존재. `ads.txt` 응답
- [ ] 열려 있는 모든 서비스 상세 화면 위쪽에 "공유하기" 버튼이 있고, 플레이 중에는 숨겨짐 (6-5). 키보드로 열고 닫을 수 있음 (Esc, 포커스 가둠)
- [ ] 모바일 기본 공유창(`navigator.share`), 데스크톱 링크 복사·문구 복사·X·페이스북 링크 동작. 복사한 링크에 `utm_source=share`가 들어 있음
- [ ] 결과 공유 문구에 별명, 기기 ID, 월급 등 입력값이 들어 있지 않음 (단위 테스트)
- [ ] "이미지로 저장"이 게임 1·2·3·6·17 결과 화면에서 PNG를 만듦
- [ ] 공유 링크를 연 페이지가 OG 미리보기(제목, 설명, 이미지)를 가짐
- [ ] Playwright: 게임 1 결과 화면에서 공유창을 열고 복사한 문구에 순위 줄과 UTM 링크가 포함됨
- [ ] 화면 어디에도 "목업", "가상", "시뮬레이션", 기획 노트 문구가 남아 있지 않음

---

## 6. 공통 모듈 사양

### 6-1. `lib/daily.ts` (클라이언트·서버 공용)

목업과 같은 난수를 쓰되 날짜는 KST로 바꾼다.

```ts
export function kstDateKey(d = new Date()): string  // 'YYYY-MM-DD' (Asia/Seoul)
export function kstSeed(d = new Date()): number      // YYYY*10000 + MM*100 + DD (KST)
export function mulberry32(seed: number): () => number  // 목업 core.js 의 rng 와 동일 구현
export function daily(salt: number, d = new Date()) { return mulberry32(kstSeed(d) * 97 + salt * 7919) }
export function msUntilKstMidnight(d = new Date()): number
```

- 서버 라우트는 제출 검증 때 **요청 시점의 서버 KST 날짜**(`kstDateKey()`)로 콘텐츠를 다시 만든다. 클라이언트가 보낸 날짜는 쓰지 않는다 (DB는 전날 도전의 제출을 이미 거부한다).
- 기기 시계가 틀린 경우: 화면 콘텐츠는 기기 시계의 KST 날짜로 만들되, `start` 응답의 `play_date`가 그 날짜와 다르면 그 판을 연습으로 바꾸고 "기기 시간이 맞지 않아 이번 판은 연습으로 기록돼요" 안내.
- 자정 넘김: 화면이 열린 채로 0시가 지나면 "새 문제가 열렸어요" 안내와 새로고침 버튼을 띄운다.

### 6-2. 기기와 프로필 (`lib/device.ts`)

- 첫 방문 때 `crypto.randomUUID()`로 기기 ID를 만들어 `localStorage['10bun:device']`에 저장. 저장소를 못 쓰면 순위 기능 없이 연습 모드만.
- 기본 별명: 목업 `compete.js`의 `NICK_A` × `NICK_B` 조합 중 **8자 이하인 것**에서 무작위 (예: "반짝이는 카피바라"는 9자라 서버가 거부한다. 단위 테스트로 모든 기본 조합이 `bun_valid_nickname` 규칙을 통과하는지 확인). 기본 시도: `'미정'`. 순위판에서 "바꾸기"로 수정. 시도가 미정이면 순위판에 "시도를 고르면 시도 대항에 들어가요" 안내.
- 모든 `localStorage` 접근은 try/catch로 감싼다.

### 6-3. 도전 흐름 (모든 순위 게임 공통 상태 기계)

```
idle → (시작 누름) → starting: POST /api/bun/start  (응답을 기다리지 않고 게임은 바로 시작)
     → playing → finished → submitting: POST /api/bun/submit → ranked | review | practice
start 실패(disabled, no_attempts, rate_limited, blocked, bad_game, network) → practice (연습 모드, 제출 안 함)
start 실패(bad_nickname, bad_region) → 별명·시도 편집 창을 열고 저장 후 다시 시작
```

- 게임 1처럼 짧은 게임도 시작 요청은 비동기로 보내고 게임을 막지 않는다. 결과가 나왔는데 시작 응답이 아직 없으면 최대 3초 기다린 뒤 연습으로 처리.
- 화면 위쪽의 공식 도전 표시(`.tks`)는 서버의 `attempts_left`로 그린다.

### 6-4. 순위판 컴포넌트 `<RankBoard gameId />`

목업 `compete.js`의 `makeBoard().render()`를 React로 옮긴다. 화면 구성은 목업과 같다: 내 순위, 상위 %, 다음 목표까지 차이("1,000위 안까지 0.056초"), 순위 사다리, 탭(TOP 10 / 내 주변 / 시도 대항 / 이번 주), 별명·시도 바꾸기.

- 데이터: `GET /api/bun/board/[gameId]` (TOP 100, 기준선, 시도, 분포, 주간) + `GET /api/bun/me/[gameId]` (내 순위, 앞뒤 3명, 남은 횟수, 주간 점수)
- 다음 목표 차이: `cutoffs['1'|'10'|'100'|'1000']`와 내 최고 기록의 차이. 게임별 차이 표기는 목업 `BOARDS[id].gap` 그대로
- 게임 17은 시도 대항 탭을 숨긴다 (게임 화면 오른쪽에 이미 시도 순위가 있음. 그 패널도 `board.regions`로 채운다)
- 게임 1은 `perfect_count`가 1 이상이면 "오늘 ±0.000초 완벽 기록 n명, 같은 기록은 먼저 낸 순서" 표시, TOP 목록의 0.000 기록 옆에 기록 시각(`achieved_at`, KST HH:mm)
- "이번 주" 탭: `week.last_week`가 false면 "어제(`week.through`)까지 반영돼요". 월요일에는 `week.last_week`가 true로 지난주 결과가 오며, `week.final`이 true면 제목 "지난주 최종 순위", false면 "지난주 순위 (집계 중)". 월요일의 "내 주간 점수"는 0점이므로 "이번 주 점수는 내일 0시부터 쌓여요" 안내. 공통 설명: "매일 상위 몇 %였는지를 0~100점으로 바꿔 월요일부터 일요일까지 더해요." 비어 있으면 "오늘 기록이 내일 0시에 처음 반영돼요"
- 내 순위 재조회: 결과 직후 1회, 이후 탭이 보이는 동안 60초마다 (`document.visibilityState === 'visible'`)
- 서버 기능이 꺼져 있으면(`enabled: false`) 순위판 대신 "지금은 순위 기능을 잠시 쉬고 있어요" 상자

### 6-5. 공유 (모든 서비스 상세 화면 공통. `lib/share.ts`, `lib/share-card.ts`, `<ShareBar />`, `<ShareSheet />`)

목적: 어느 서비스든 화면 안에서 한두 번 눌러 친구에게 보낼 수 있게 한다. 열려 있는 서비스가 늘어나도 서비스마다 따로 만들지 않고 이 공통 부품을 쓴다.

**어디에 둔다**
- 열려 있는 **모든 서비스 상세 화면**(`[slug]/page.tsx`)의 제목 줄 오른쪽에 `<ShareBar />`("공유하기" 버튼, 터치 영역 44px 이상). 게임 8, 9, 10과 2단계 이후 서비스도 같다. 목업의 서비스 카드 모서리에는 두지 않는다.
- 결과가 나오면 결과 영역에 큰 "결과 공유" 버튼을 따로 보여 준다 (목업 `#sh`). 두 버튼은 같은 `<ShareSheet />`를 연다.
- **플레이 중에는 ShareBar를 숨긴다** (6-3의 `playing` 상태: 게임 1·3·6·15·17). 시간이 흐르는 게임에서 실수로 눌러 방해받는 것을 막는다. 기다리는 화면(idle), 결과, 연습 모드에서는 보인다.
- 광고 단위와 겹치지 않게 한다 (광고는 조작 버튼에서 150px 이상 떨어진 아래쪽).

**두 가지 공유 종류**
| 종류 | 언제 | 문구 |
|---|---|---|
| `invite` (초대) | 시작 전, 연습 모드, 결과가 없는 서비스 | `[오늘의 {서비스명}] {한 줄 설명}\n{예상 시간}이면 끝나요\n{링크}` (서비스명·한 줄 설명·예상 시간은 `content/` 서비스 목록의 `title`, `line`, `time`) |
| `result` (결과) | 도전 결과가 나온 뒤 | 아래 표의 결과 문구 + 순위가 있으면 마지막 줄 `전국 312위 / 18,402명` + 링크 |

**결과 문구** (목업의 각 게임 `share({...})` 문구를 그대로 쓴다. 날짜는 KST `M/D`)
| 서비스 | 문구 |
|---|---|
| 1 | `정확히 10초 {M/D}\n목표 {목표}초, 오늘 최고 ±{최고}초\n{🟩/⬜ 5칸}` |
| 2 | `오늘의 색 {M/D}\n{점수} / 50점\n{색별 이모지}` |
| 3 | `오늘의 도형 {M/D} (완벽한 원)\n오늘 최고 {점수}점` |
| 6 | `숫자 만들기 {M/D}\n목표 {목표}, {m}분 {s}초, {n}단계\n{⭐ 5칸}` |
| 8 | 국밥·아메리카노 같은 **환산 단위만** 쓴다. **월급, 금액 숫자, 출퇴근 시각은 문구에 절대 넣지 않는다.** 결과가 있어도 `invite` 문구를 기본으로 하고 환산 단위 한 줄만 더한다 |
| 17 | `시도 대항 반응속도 {M/D}\n나 {평균}ms, {시도} 평균에 보탰다\n{시도} 현재 {n}위. 다들 도와줘` |
| 15 | `오늘의 슬라이드 퍼즐 {M/D} ({n}×{n})\n{m분 s.ss초}, {이동}번 이동` (11절) |
| 2단계 이후 | 목업 문구 그대로. 서비스를 열 때 이 표에 추가한다 |

**공유창 `<ShareSheet />`** (모달 대화상자. 모바일은 아래에서 올라오는 시트, 데스크톱은 가운데 상자. `role="dialog" aria-modal="true"`, 처음 포커스는 첫 버튼, Esc와 바깥 클릭으로 닫힘, 닫으면 공유 버튼으로 포커스 복귀)
- 위쪽: 공유될 문구와 링크 미리보기 (읽기 전용).
- 버튼 (표시 조건):
  1. **공유하기**: `navigator.share`가 있을 때. `{ title, text, url }`로 호출. 사용자가 취소하면(`AbortError`) 아무 안내 없이 닫는다. 그 밖의 오류는 아래 복사 버튼으로 대체.
  2. **링크 복사**: 항상. 복사 후 토스트 "링크를 복사했어요".
  3. **문구와 링크 복사**: 항상. 토스트 "복사했어요. 단톡방에 붙여 넣으세요" (목업 문구). 클립보드가 막히면 문구를 선택 가능한 입력칸으로 보여 주고 "길게 눌러 복사하세요".
  4. **이미지로 저장**: 결과 카드가 있는 서비스(게임 1·2·3·6·17, 15)의 `result` 상태에서만. 아래 "결과 카드".
  5. **X**, **페이스북**: `navigator.share`가 없는 환경(데스크톱)에서만. 일반 링크 `https://twitter.com/intent/tweet?text=…&url=…`, `https://www.facebook.com/sharer/sharer.php?u=…`을 `target="_blank" rel="noopener noreferrer"`로 연다. 외부 SDK는 넣지 않는다.
- **카카오톡 전용 버튼과 카카오 SDK는 만들지 않는다.** 모바일 기본 공유창에 카카오톡이 들어 있고, SDK는 키 관리와 개인정보처리방침 항목이 늘어난다. 나중에 필요하면 보강 항목으로 보고한다.
- 공유를 강요하지 않는다: 자동으로 열지 않고, 공유해야 다음 단계로 가거나 보상을 받는 구조 금지.

**링크**
`https://10bun.com/<slug>?utm_source=share&utm_medium=<native|copy|text|x|facebook|image>&utm_campaign=<slug>&utm_content=<YYYYMMDD>&utm_term=<invite|result>`
- 링크로 들어온 사람은 평소 서비스 화면을 본다 (특별한 화면을 만들지 않는다). 링크에 점수나 닉네임을 싣지 않는다.
- 페이지 `metadata`의 OG 이미지 `public/og/<slug>.png`(1200×630, 서비스마다 1장)와 `twitter:card = summary_large_image`로 링크 미리보기가 보이게 한다 (9절 SEO).

**결과 카드 (`lib/share-card.ts`, 이미지로 저장)**
- 브라우저 캔버스로 1080×1080 PNG를 만든다 (서버 요청 없음). `document.fonts.ready`를 기다린 뒤 그린다.
- 구성: 서비스 이름과 날짜, 큰 결과 값(예: "±0.043초", "3분 12초"), 순위 줄(있을 때), 아래쪽 "10bun.com". 배경색은 서비스 그룹 색(`GROUPS[g].color`).
- 별명, 시도, 기기 ID는 넣지 않는다. 15번은 완성한 그림 위에 시간을 얹고 "그림은 AI로 만들었어요"를 작게 넣는다.
- 가능하면 `navigator.canShare({ files })`로 파일 공유, 안 되면 다운로드 링크(`10bun-<slug>-<YYYYMMDD>.png`).

**개인정보 규칙**: 공유 문구·링크·이미지에 별명, 기기 ID, IP, 정확한 위치(시도보다 자세한 것), 월급·금액 입력값을 넣지 않는다. 단위 테스트로 위 표의 모든 문구 생성 함수에 닉네임·UUID 형태 문자열이 없는지 확인한다.

**분석**: 9절의 `share_*` 이벤트에 `game`, `kind`(invite/result)를 담는다.

**2단계 보강 후보** (지금은 만들지 않음): 친구 기록에 도전하는 링크(`?vs=`), 카카오톡 버튼, 서비스별 동적 OG 이미지.

### 6-6. 오류 코드와 화면 문구 (`lib/errors.ts`)

| 코드 | 화면 문구 | 처리 |
|---|---|---|
| `disabled` | 지금은 순위 기능을 잠시 쉬고 있어요. 연습으로 계속할 수 있어요. | 연습 모드 |
| `no_attempts` | 오늘 공식 도전을 다 썼어요. 0시에 다시 열려요. | 연습 모드 |
| `rate_limited` | 같은 네트워크에서 도전이 너무 많아요. 잠시 뒤에 다시 해 주세요. | 연습 모드 |
| `blocked` | 이 기기는 순위에 참여할 수 없어요. | 연습 모드 |
| `expired` | 도전 시간이 지났어요. 자정이 지나면 전날 도전은 제출되지 않아요. | 결과만 표시 |
| `invalid_score`, `verify_failed` | 기록을 확인하지 못해 순위에 올리지 못했어요. | 결과만 표시 |
| `review` (status) | 놀라운 기록이라 확인하고 있어요. 확인이 끝나면 순위에 들어가요. | 결과만 표시 |
| `bad_nickname` | 별명은 2~8자 한글, 영문, 숫자로 정해 주세요. | 입력 유지 |
| `bad_region` | 시도를 다시 골라 주세요. | 입력 유지 |
| `bad_game` | 지금은 이 게임의 순위를 쉬고 있어요. | 연습 모드 |
| `not_found`, `already_submitted`, `bad_request` | 기록을 저장하지 못했어요. 새로고침 후 다시 해 주세요. | 결과만 표시. 오류 로그 남김 |
| `too_fast` | 잠시 뒤에 다시 바꿔 주세요. | 입력 유지 |
| 네트워크 오류 | 연결이 불안정해요. 이번 판은 연습으로 기록돼요. | 연습 모드 |

---

## 7. 데이터베이스 적용 절차

### 7-1. 로컬 (0단계)

1. `supabase init` 후 부록 B를 `supabase/migrations/20261114000001_bun_core.sql`로 저장, `supabase start` (마이그레이션 자동 적용. B가 `bun_app` 역할을 로그인 불가로 만든다)
2. 로컬 DB(`postgresql://postgres:postgres@127.0.0.1:54322/postgres`)에서 부록 A를 로컬 비밀번호로 실행
3. 로컬 DB에서 `create extension if not exists pg_cron;` 후 부록 C 실행
4. `scripts/check-db.ts`: `bun_app`으로 접속해 `select bun_get_board(1::smallint)`가 되는지, `select * from bun_scores`가 **권한 오류**로 막히는지 둘 다 확인
5. `supabase db reset`(로컬 전용)을 하면 역할 비밀번호가 사라지므로 2번을 다시 실행
6. 이 문서의 예전 버전 SQL을 로컬에 적용한 적이 있으면 먼저 `supabase db reset` (새 열이 추가되지 않는다). 운영에는 적용한 적이 없으므로 해당 없음

### 7-2. 운영 (1단계 체크포인트 승인 후, 운영자가 직접 실행)

1. 퀴즈오아시스 Supabase 대시보드 > SQL Editor에서 **부록 B** 실행
2. 이어서 **부록 A** 실행 (32자 이상 무작위 비밀번호로 교체). 실행 후 그 SQL 스니펫을 삭제한다
3. Integrations > Cron에서 pg_cron을 켜고 **부록 C** 실행
4. 연결 주소: 대시보드 Connect > **Shared pooler(Supavisor)** 의 Transaction 모드 주소(포트 6543)를 쓴다. Vercel은 IPv4만 되므로 직접 연결 주소나 전용 풀러(IPv6)는 쓰지 않는다. 사용자명을 `bun_app.<project_ref>`로, 비밀번호를 부록 A 값으로 바꾸고 끝에 `?sslmode=require`
5. `scripts/check-db.ts`를 운영 주소로 한 번 실행해 7-1의 4번 두 가지를 확인
6. **연결이 안 될 때**: 사용자명 형식(`bun_app.<project_ref>`), 포트(6543), 호스트가 Shared pooler인지 확인하고, 그래도 안 되면 부록 A로 비밀번호를 다시 설정한다. service_role 키로 우회하지 않는다 (퀴즈오아시스 전체 권한 키다). 해결이 안 되면 멈추고 보고한다

### 7-3. `lib/db.ts`

```ts
import postgres from 'postgres';
const url = process.env.BUN_DATABASE_URL;
export const sql = url ? postgres(url, {
  prepare: false,          // 트랜잭션 풀러에서 필수
  max: 3, idle_timeout: 20, connect_timeout: 5,
  ssl: url.includes('127.0.0.1') ? false : 'require',
}) : null;                 // 값이 없으면(미리보기 배포 등) 순위 API는 { ok:false, code:'disabled' } 반환
if (!url && process.env.VERCEL_ENV === 'production') {
  throw new Error('BUN_DATABASE_URL missing in production');   // 운영에서 조용히 연습 모드로 도는 것 방지
}
// 모든 호출은 함수 하나를 부르고 jsonb 결과를 그대로 받는다
// 예: const [{ r }] = await sql`select public.bun_get_board(${id}::smallint) as r`
```

라우트는 모두 `export const runtime = 'nodejs'`. 풀러는 `bun_app` 전용 연결 풀을 따로 만들고 역할 연결 상한은 20이다 (부록 A).

---

## 8. API 계약

공통: 요청 본문은 zod로 검증하고 실패하면 400 `{ ok:false, code:'bad_request' }`. DB 함수가 돌려준 `{ ok:false, code }`는 HTTP 200으로 그대로 전달한다 (화면이 코드로 분기).

### `GET /api/bun/board/[gameId]`
- `bun_get_board(gameId)` 결과 그대로. 헤더 `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`
- 주요 필드: `enabled, play_date, participants, top[{rank,nickname,region,score,achieved_at}], cutoffs{1,10,100,1000}, regions[{region,avg,count}], dist[{tries,count}]|null, perfect_count|null, week{from, through, last_week, final, top[{rank,nickname,region,points,days}]}, computed_at`

### `GET /api/bun/champions`
- `bun_get_champions()` 결과. 캐시 헤더는 위와 같음. 홈 "오늘의 1위"와 실시간 패널에 사용

### `GET /api/bun/me/[gameId]` (헤더 `x-bun-device: <uuid>`)
- 기기 ID는 주소가 아니라 헤더로 보낸다 (로그·방문 기록에 남지 않게). `bun_my_board(gameId, device)`. `Cache-Control: no-store`
- 필드: `play_date, enabled, nickname, region, blocked, attempts_used, attempts_left, week_points, week_days, has_record, best, rank, participants, pct, above[], below[]`

### `POST /api/bun/profile` `{ device, nickname, region }`
- `bun_set_profile`. 별명은 앞뒤 공백 제거 후 전달

### `POST /api/bun/start` `{ gameId, device, nickname, region }`
- 서버가 IP 해시를 만든다: `sha256(ipKey + '|' + kstDateKey() + '|' + BUN_IP_SALT)` 16진수. IP는 `x-forwarded-for`의 첫 값, 없으면 `x-real-ip`, 그것도 없으면 `'0.0.0.0'`. **IPv6는 앞 64비트(/64)만** `ipKey`로 쓴다 (주소를 바꿔 가며 제한을 피하는 것 방지). 원본 IP는 저장·로그하지 않는다
- `bun_start_attempt(gameId, device, ipHash, nickname, region)` 결과 전달: `{ ok, attempt_id, attempt_no, attempts_left, play_date }` 또는 `{ ok:false, code }`

### `POST /api/bun/submit` `{ attemptId, device, gameId, score, elapsed, meta }`
- `elapsed`: **시작 요청을 보낸 순간부터 제출 요청을 보내는 순간까지**의 초(클라이언트 `performance.now()` 기준). DB의 경과 시간 검사와 같은 구간이다. 게임 안의 시간(게임 1의 경과, 게임 6의 푼 시간)은 `meta`에 따로 담는다
1. 게임별 검증 함수(`lib/games/<slug>.ts`의 `verify(serverDate, score, meta)`)로 **서버에서 점수를 다시 계산**한다. `serverDate`는 요청 시점 `kstDateKey()`. 다르면 DB를 부르지 않고 `{ ok:false, code:'verify_failed' }`
2. 통과하면 서버가 다시 계산한 점수로 `bun_submit_score(attemptId, device, score, elapsed, meta)` 호출
3. 결과 전달: `{ ok, status:'ranked'|'review', score, improved, best, rank, prev_rank, participants, pct, attempts_left }`
- `meta`는 직렬화 후 4KB를 넘으면 400

---

## 9. 분석과 광고

### GA4 이벤트 (`lib/analytics.ts`)

| 이벤트 | 매개변수 |
|---|---|
| `game_start` | `game`, `official`(true/false) |
| `game_complete` | `game`, `official`, `score` |
| `rank_result` | `game`, `rank`, `participants`, `improved` |
| `retry_click` | `game`, `attempts_left` |
| `share_open` / `share_native` / `share_copy`(`type`: link·text) / `share_image` / `share_x` / `share_facebook` | `game`, `kind`(invite·result), `source`(bar·result) |
| `board_tab` | `game`, `tab` |
| `profile_change` | `region_changed` |
| `practice_start` | `game`, `reason`(오류 코드) |

판정 지표(첫 공개 후 72시간): 세션 수, 공유 행동 비율(share_* / game_complete, 시작 전 `invite` 공유 포함), 공유 종류별 비율, 공유 링크 유입 세션 비율(utm_source=share), 다음 날 재방문율, 세션당 페이지뷰, 다시 도전 비율(retry_click / rank_result).

### 애드센스
- `public/ads.txt`: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` (게시자 ID는 운영자에게 받음)
- 애드센스 관리 화면에서 10bun.com의 **자동 광고를 끈다** (게임 조작 버튼 옆에 광고가 붙는 것을 막기 위해). 운영자에게 체크리스트로 알린다
- 광고 단위 `<AdSlot />`: 화면 아래 본문 영역, 조작 버튼과 150px 이상 떨어진 위치. 게임 중에는 화면 밖. 자동 새로고침 금지. 클릭 유도 문구 금지
- 게임 3·10·14·15의 조작 화면에는 광고 없음
- 유럽(EEA)·영국 방문자용 동의 문구: 애드센스 "개인 정보 보호 및 메시지"의 Google 동의 관리 도구를 켜도록 운영자 체크리스트에 넣는다

### 법적 페이지
- `/privacy` (개인정보보호법 기준 항목. 최종 문구는 운영자가 검토):
  - 수집 항목: 무작위 기기 ID, 별명, 시도, 게임 기록, 날짜별로 바뀌는 IP 해시. 이름·연락처·위치는 받지 않음
  - 목적: 순위 운영, 부정 이용 방지
  - 보관과 파기: 게임 기록 30일, 일별 상위 100명 별명·기록 400일, 마지막 방문 후 90일 지난 프로필 삭제. 기간이 지나면 매일 자동 삭제
  - 처리 위탁·국외 이전: Supabase(데이터베이스, 프로젝트 지역은 운영자가 확인해 기재), Vercel(웹 호스팅, 미국), Google(애드센스·애널리틱스). 항목, 국가, 목적, 보관 기간을 표로
  - 쿠키와 기기 저장소: 애드센스·GA4 쿠키, Google 파트너 사이트 정책 링크, 맞춤 광고 거부 방법(Google 광고 설정 링크), 브라우저 쿠키 차단 방법
  - 이용자 권리: 기록 삭제 요청 방법 (순위판에 "내 기록 삭제 요청" 링크 → 문의 페이지. 기기 ID를 함께 보내도록 안내. 운영자는 `bun_forget_device`로 처리)
  - 만 14세 미만: 별도 개인정보를 받지 않으며 별명에 실명을 쓰지 말라는 안내
  - 개인정보 보호책임자 이름·연락처: `TODO(운영자 확인)`
- `/terms`: 순위 부정 행위 시 기록 삭제·참여 제한 가능, 서비스 변경 가능
- `/about`, `/contact`

### SEO
- 페이지마다 `metadata`(제목, 설명, OG 이미지 `public/og/<slug>.png`), `sitemap.ts`(열린 서비스만), `robots.ts`
- 워드프레스 시절 주소: 운영자에게 기존 URL 목록을 받는다. 같은 주제의 새 페이지가 있는 주소만 301, 나머지 옛 글은 410(삭제됨)으로 응답 (모두 홈으로 보내면 검색엔진이 soft 404로 본다)
- 도메인 전환 중에도 `ads.txt`가 끊기지 않게 새 사이트 배포 후 DNS를 바꾼다. 콘텐츠가 완전히 바뀌므로 애드센스 사이트 재검토가 생길 수 있음을 운영자 체크리스트에 적는다

---

## 10. 1단계 게임 사양

모든 게임은 목업의 화면과 동작을 기준으로 한다. 아래는 목업과 다르거나 서버와 맞춰야 하는 부분만 적었다. 채점 함수는 `lib/games/<slug>.ts`에 순수 함수로 두고 클라이언트와 서버가 같은 함수를 쓴다.

### 공통 규칙 표

| ID | slug | 하루 공식 도전 | 점수 | 좋은 쪽 | 서버 경과 시간 검사 |
|---|---|---|---|---|---|
| 1 | 10sec | 5 | \|경과-목표\| 초, 소수 3자리 | 낮음 | 예 (허용 3초) |
| 2 | color | 1 | 0~50점, 소수 2자리 | 높음 | 아니오 |
| 3 | shape | 5 | 0~100점, 소수 2자리 | 높음 | 아니오 |
| 6 | number | 1 | 푼 시간(초) | 낮음 | 예 (허용 5초) |
| 17 | reaction | 5 (한 판 = 3번 누름) | 3번 평균 ms | 낮음 | 아니오 |

### 게임 1 오늘의 정확히 10초 (`/10sec`)
- 목표: `target = (500 + floor(daily(1)() * 800)) / 100` (5.00~12.99초)
- 시작 누름 = 시간 측정 시작 + 시작 요청. 1.5초 뒤 숫자 흐림. 멈춤 누름 = 측정 끝. `performance.now()` 사용
- 제출: `score = round3(|gameElapsed - target|)`, `elapsed`(8절 정의), `meta: { gameElapsed }` (초, 소수 3자리)
- 서버 검증: `meta.gameElapsed`가 1.5~60, `|round3(|gameElapsed - target(serverDate)|) - score| <= 0.0015`. 목표는 서버가 직접 계산하고 클라이언트 값은 받지 않는다
- 경과 시간 검사(허용 3초)는 기본 점검일 뿐이다. ±0.000초 기록은 자동 검토(`review_at = 0`)로 들어가 운영자가 확인한 뒤 순위에 반영된다 (자정 직후 스크립트가 1위를 가져가는 것 방지). 결과 화면 문구: "±0.000초! 놀라운 기록이라 확인 후 순위에 들어가요"
- 화면: 목업 그대로 (결과에 순위 문장, "다시 도전 (n번 남음)", 소진 후 "연습으로 다시")

### 게임 2 오늘의 색 (`/color`)
- 색 5개: 목업 `COLORS` 그대로 (`daily(2)`, h 0~360, s 35~95, b 42~97). 각 3초 표시 후 HSB 슬라이더로 재현
- 색 하나 점수: `round(1000 * exp(-dE / 26)) / 100` (0~10), `dE`는 목업 `rgb2lab` 기반 CIE76. 합계를 소수 2자리로
- 제출: `score`, `meta: { picks: [[h,s,b] x5] }`
- 서버 검증: picks로 5개 점수를 다시 계산해 합계가 `score`와 0.05 이내
- 시작 누름 = 도전 시작. 하루 1번이므로 시작 버튼 아래에 "공식 도전은 하루 한 번이에요" 표시
- 49.5점 이상은 자동 검토(`review_at`)

### 게임 3 오늘의 도형 (`/shape`) — 1단계는 "완벽한 원"만
- 채점: 목업과 같음. 중심 기준 반지름 평균 m, 표준편차 sd, `score = clamp(100 - (sd / m) * 100 * 3.1, 0, 100)` 소수 2자리. 유효 조건: 한 바퀴 300도 이상, `m >= 캔버스 폭 * 0.12`, 점 30개 이상
- 공식 도전은 **유효한 원을 그려 손을 뗀 순간에만** 1회 차감한다. 그때 시작 요청을 보내고 응답을 받는 즉시 제출한다 (게임 3은 경과 시간 검사가 없어서 가능). 덜 그린 원이나 실수 터치는 횟수를 쓰지 않는다
- 제출: `score`, `meta: { pts: [[x,y],...] }` (0~1로 정규화, 소수 3자리, 최대 200점으로 줄임), 캔버스는 정사각형
- **공식 점수는 보내는 바로 그 `pts`(정규화·축소한 점)로 계산한다.** 화면에 보이는 공식 점수도 같은 배열로 계산해야 서버와 어긋나지 않는다 (그리는 동안의 실시간 %는 원본 점으로 계산해도 됨)
- 서버 검증: pts로 점수·회전각·크기 조건을 다시 계산, 점수 차 0.05 이내. 99.5점 이상은 자동 검토
- 조작 화면에 광고 없음

### 게임 6 오늘의 숫자 만들기 (`/number`)
- 퍼즐: 목업 `PUZ` 생성기(`daily(6)`) 사용. 단, 실패 시 예비 퍼즐 대신 시도 횟수를 늘려 반드시 풀이 있는 문제를 낸다 (4-11)
- **시작 화면 추가**: 숫자와 목표를 가린 상태로 "시작"을 누르면 공개 + 시간 측정 + 시작 요청
- 제출: `score = 푼 시간(초, 정수)`, `elapsed`(8절 정의), `meta: { solveSeconds, ops: [[i, op, j], ...] }`
- `ops` 형식: 칸 번호는 처음 6칸의 고정 번호(0~5). `[i, op, j]`는 "i칸 값(왼쪽) op j칸 값(오른쪽)"이며, 결과는 j칸에 들어가고 i칸은 빈칸이 된다 (목업의 동작과 같음). 되돌리기한 연산은 ops에서 지운다. `op`는 `'+' | '-' | '*' | '/'`
- 서버 검증: 같은 날의 숫자로 ops를 순서대로 다시 적용 (빈칸 사용 금지, 나누어떨어짐, 결과 양수) → 마지막 결과가 목표와 같아야 함. 5초 미만이면 거부. 12초 이하는 자동 검토
- "풀이 보기"를 누르면 먼저 확인 창: "풀이를 보면 오늘 순위 도전은 끝나요." 확인 시 이후 제출하지 않음

### 게임 17 시도 대항 반응속도 (`/reaction`)
- 한 판 = 초록 신호에 3번 누르기. 대기 1.2~3.6초 무작위(클라이언트). 너무 일찍 누르면 그 회차만 다시
- 한 판의 첫 누름 직전에 시작 요청. 세 번 끝나면 제출
- 제출: `score = round(평균 ms)`, `meta: { taps: [ms, ms, ms] }`
- 서버 검증: 각 값 100~2000, 평균이 score와 1 이내. 평균 150ms 이하는 자동 검토
- 오른쪽 시도 순위 패널은 `board.regions`(오늘 모든 판의 시도 평균)로 그린다. 순위판의 시도 대항 탭은 숨김
- **시도를 고르기 전에는 공식 판을 시작하지 않는다.** 시도가 '미정'이면 누르기 패드 대신 시도 선택 상자를 먼저 보여 주고, 고르면 `/api/bun/profile`로 저장 (게임 화면의 시도 선택 상자도 같은 API. `too_fast`면 잠시 뒤 다시)
- 키보드: Space/Enter로도 누를 수 있게

### 게임 8 오늘 번 돈 (`/earned`) — 서버 없음, 순위 없음
- 목업 그대로. 월급은 기기 저장소에만 저장하고 어떤 요청에도 담지 않는다. 화면에 "입력값은 이 기기에만 저장돼요" 문구 유지

### 홈 (`/`)
- 오늘의 세트: 열린 게임 중 `content/today-set.ts`에 정한 4개 (1단계 기본 `[1, 2, 3, 6]`). 다이얼의 칸 길이는 서비스별 예상 시간에 비례
- "오늘의 1위": `/api/bun/champions`. 참가자 0명이면 "첫 1위가 되어 보세요"
- 실시간 패널: 오늘의 1위 중 2~3개 + 0시 초기화 카운트다운. 가짜 수치 금지
- 서비스 선반: 열린 서비스만. 필터(전체 / 혼자 / 모두와 / 순위 경쟁)는 목업 그대로

### 사용자용 설명 문구 (오른쪽 패널, 목업의 "사용설명서" 자리)

**게임 1**
- 하는 법: 시작을 누르면 시간이 흐르고 1.5초 뒤 숫자가 흐려져요. 오늘의 목표 시간이 됐다고 느낄 때 멈춤을 누르세요.
- 규칙: 공식 도전은 하루 5번이고 가장 좋은 기록이 전국 순위에 올라요. 1000분의 1초까지 겨루고 같은 기록이면 먼저 낸 사람이 앞이에요. 순위는 매일 0시에 초기화돼요.
- 자주 묻는 질문: 목표 시간은 모두 같나요? 네, 오늘 참여하는 모든 사람이 같은 목표에 도전해요. / 연습도 기록되나요? 공식 도전을 다 쓴 뒤의 연습은 순위에 들어가지 않아요.

**게임 2**
- 하는 법: 색 5개가 하나씩 3초 동안 나타나요. 사라진 색을 색상, 진하기, 밝기 슬라이더로 다시 만드세요.
- 규칙: 하루 한 번 도전할 수 있어요. 사람 눈 기준으로 얼마나 가까운지 색마다 10점, 50점 만점이에요.
- 자주 묻는 질문: 왜 하루 한 번인가요? 정답 색을 본 뒤에 다시 하면 공정하지 않아서예요. 대신 매일의 성적이 "이번 주" 순위에 쌓여요.

**게임 3**
- 하는 법: 가운데 점을 중심으로 손을 떼지 않고 원을 한 바퀴 그리세요. 손을 떼면 채점해요.
- 규칙: 공식 도전은 하루 5번, 최고점이 순위에 올라요. 원이 작거나 덜 이어지면 점수가 나오지 않아요.
- 자주 묻는 질문: 점수는 어떻게 매기나요? 점과 선 사이 거리가 얼마나 고른지로 매겨요. 초록은 고른 구간, 빨강은 튄 구간이에요.

**게임 6**
- 하는 법: 시작을 누르면 숫자 6개와 목표 숫자가 나와요. 숫자, 연산, 숫자 순서로 눌러 목표를 만드세요.
- 규칙: 하루 한 번, 푼 시간으로 순위를 매겨요. 풀이를 보면 그날 순위 도전은 끝나요.
- 자주 묻는 질문: 풀이가 여러 개인가요? 네, 목표 숫자만 만들면 어떤 방법이든 정답이에요.

**게임 17**
- 하는 법: 화면이 초록색으로 바뀌면 바로 누르세요. 세 번의 평균이 한 판 기록이에요.
- 규칙: 하루 5판까지, 가장 빠른 판이 개인 순위에 오르고 모든 판은 내 시도 평균에 들어가요. 100ms보다 빠른 기록은 제외돼요.
- 자주 묻는 질문: 시도는 어떻게 정하나요? 처음 시작할 때나 순위판의 "바꾸기"에서 직접 골라요. 위치 정보는 받지 않아요.

**게임 8**
- 하는 법: 월급과 출퇴근 시간을 한 번 넣으면 지금까지 번 돈이 초 단위로 올라가요.
- 규칙: 하루 근무일은 월 21.7일로 계산해요. 입력값은 이 기기에만 저장되고 어디로도 보내지 않아요.

모든 순위 게임 공통 문단: "기록은 30일 동안 보관돼요. 사람 한계에 가까운 기록은 확인 후 순위에 들어가고, 부정한 방법으로 낸 기록은 순위에서 빠질 수 있어요."

---

## 11. 2·3단계 개요 (지금은 구현하지 않음)

### 2단계 (데이터·외부 조건 확인 후)
- **4 그때 그 가격**: `content/prices.json` 항목마다 `name, year, price, source_url, source_name` 필수. 출처 없는 항목이 있으면 빌드 실패. 운영자가 60개 이상 채운 뒤 `update bun_games set is_active = true where game_id = 4;`. 검증: `meta.guesses` 5개로 정확도 점수 재계산 (품목당 `round(200 * exp(-2 * |ln(guess/price)|))`)
- **5 오늘의 동네**: 시군구 경계 데이터의 출처와 이용 조건(상업적 이용 가능 여부) 확인 후 진행. 검증: `meta.guesses`(지명 목록)로 시도 수와 정답 여부 재계산, 점수 = 시도수×1000 + min(999, 초), 실패는 7000 + 초
- **7 오늘 뭐 입지**: 기상청 단기예보 API(공공데이터포털) 키 필요. 서버 라우트에서 격자별 1시간 캐시. Open-Meteo는 비상업 조건이라 쓰지 않음
- **9 점심 뭐 먹지**: 돌림판 결과와 거부 목록을 링크 주소에 담아 팀원이 거부권을 1번 쓰고 다시 돌린 링크를 돌려보내는 방식. 서버 없음
- **10 그려서 맞혀봐**: 목업처럼 그림 좌표를 링크에 담음. 그림 보는 화면에 광고 없음
- **도형 요일 과제**: 정사각형, 직각, 정삼각형, 반대 손 원. 과제별 채점식을 먼저 보고
- **15 오늘의 슬라이드 퍼즐** (`/puzzle`): 아래 상세 사양

#### 게임 15 오늘의 슬라이드 퍼즐 (`/puzzle`)

한 줄: 완성 그림을 잠깐 보여 준 뒤 조각이 섞이고, 가장 빨리 맞추는 사람이 전국 순위에서 앞선다. 완성하면 격자가 사라지고 그림 전체가 보인다. 그림은 운영자가 AI로 만든 1:1 그림이고, 사용자가 올리는 것은 없다 (검수할 것이 없다).

**선행 조건 (없으면 구현하지 말고 보고)**
- 부록 D 적용 (`bun_games` 15번 행. 처음엔 비활성).
- `content/puzzle-schedule.json`에 오늘부터 7일 이상의 그림이 있고 `public/puzzle/`에 파일이 있음. 운영 방법은 `puzzle/README-puzzle-images.md`(운영자가 전달)를 따른다.
- 활성화는 운영자가 화면 확인 후: `update bun_games set is_active = true where game_id = 15;`

**공통 규칙 표 행**: ID 15 | slug `puzzle` | 하루 공식 도전 1 | 점수 푼 시간(초, 소수 2자리) | 낮음 | 서버 경과 시간 검사 예 (허용 5초) | 자동 검토 3초 이하 (부록 D)

**판 크기 (KST 날짜)**: 평일은 격일로 3×3과 4×4를 번갈아 쓴다 (`kstSeed(date) % 2 === 0` 이면 3, 아니면 4). 토·일은 4×4. 연습 모드에서는 3·4·5를 고를 수 있다. 그림은 정사각형이라 칸도 정사각형. 빈칸은 오른쪽 아래.

**퍼즐 생성 (`lib/games/puzzle.ts`, 클라이언트·서버 공용 순수 함수, 데이터 파일 없음)**
- 기준 구현: `reference/puzzle.ref.mjs` (그대로 TypeScript로 옮긴다. 상수와 로직을 바꾸지 않는다). 날짜 시드는 `daily(15)`와 같은 `kstSeed(date) * 97 + 15 * 7919`.
- 방법: 완성 상태에서 빈칸을 직전 위치로 되돌아가지 않게 무작위로 `WALK`번(4×4 160, 5×5 300. 연습용 3×3은 80) 움직인다. 이동으로만 만들기 때문에 **항상 풀 수 있다**. 맨해튼 거리 합이 `MIN_MANHATTAN`(4×4 34, 5×5 60. 연습용 3×3은 14) 미만이면 계속 움직여 너무 쉬운 판을 거른다. 이미 풀려 있으면 오류.
- 단위 테스트 (`reference/puzzle.test.mjs` 참고): 365일 모두 생성되고, 같은 날짜는 항상 같은 판, 요일별 크기 일치, 15퍼즐 패리티 검사로 풀이 가능, 3×3(연습용 크기)은 BFS 풀이를 `replay`로 통과시키고 마지막 한 수를 뺀 기록은 거부. (기준 구현으로 2026-12-01부터 365일 점검: 4×4 261일, 5×5 104일, 맨해튼 합은 4×4 34~48, 5×5 60~90.)

**화면 흐름**
1. `idle`: 판 크기, "공식 도전은 하루 한 번이에요", "시작" 버튼. ShareBar 보임 (6-5, invite).
2. 시작 누름 → `POST /api/bun/start` (게임 15의 응답에는 서버가 `puzzle: { size, image }`를 덧붙인다. `image`는 **시작에 성공했을 때만** 오늘 그림 주소. 일정표에 오늘이 없으면 `image: null`).
3. **미리보기 3초**: 완성 그림을 화면 가득 보여 주고 3·2·1 표시. 탭하면 건너뛸 수 있지만 1초 뒤부터. 이 시간은 기록에 넣지 않는다.
4. **섞기 0.5초**: 격자선이 나타나며 조각이 섞이는 연출 (최종 배치는 `makePuzzle` 결과 그대로).
5. `playing`: **시간 측정은 섞기가 끝나 판이 보이는 순간부터** (첫 조각을 움직인 순간이 아니다. 판을 보며 미리 계획하는 시간이 공짜가 되지 않게). 타이머를 화면에 보여 주고 이동 횟수도 표시한다. ShareBar 숨김.
6. 완성: 시간 측정 멈춤 → 조각 사이 틈이 사라지고 **격자 없는 완성 그림**이 나오는 연출 → 기록 제출 → 결과(시간, 이동 횟수, 순위) + 결과 공유 + 한 줄 문구. 푸터 "그림은 AI로 만들었어요".
- 그림이 없으면(`image: null`) 같은 판을 **번호 타일**로 보여 준다. 순위는 그대로 동작한다. 서버는 `console.error('puzzle: no image scheduled', date)`를 남긴다 (Vercel 로그에서 확인. DB 알림 테이블은 쓰지 않는다).
- 순위는 **시간만**으로 매긴다. 이동 횟수는 표시만 한다.
- 랭킹 판에는 번호를 보여 주지 않는다 (그림만). 순위가 하루 안에서만 비교되므로 그림 난이도가 날마다 달라도 공정하다.

**조작**: 빈칸 옆 조각을 누르면 그 조각이 빈칸으로 움직인다. 같은 줄·열에 있는 조각을 누르면 빈칸까지 한 줄이 밀린다 (이동 기록에는 한 칸씩 풀어서 적는다). 키보드: 방향키는 "빈칸이 움직이는 방향"이 아니라 **"조각이 움직이는 방향"**으로 처리 (→를 누르면 빈칸 왼쪽 조각이 오른쪽으로). 조각은 포커스를 받을 수 있고 Enter로도 움직임. `prefers-reduced-motion`이면 연출을 줄인다.

**제출**: `score = 푼 시간(초, 소수 2자리, 섞기 끝 ~ 마지막 이동)`, `elapsed`(8절 정의: 시작 요청 ~ 제출 요청, 미리보기·섞기 포함), `meta: { n, moves: "UDLR…", solveMs }`. `moves`는 한 글자가 **빈칸이 움직인 방향**(U/D/L/R). 길이는 5×5에서 600자 이하로 충분하며 4KB 제한을 넘지 않는다.

**서버 검증 (`verify(serverDate, score, meta)`)**
1. `makePuzzle(serverDate)`로 판을 다시 만들고 `replay(puzzle, moves)`를 실행해 **풀리는지**와 이동 횟수를 확인. 안 풀리면 `verify_failed`
2. `meta.n`이 그날 크기와 같아야 함
3. `|solveMs / 1000 - score| <= 0.01`
4. `elapsed - solveMs / 1000 >= 3.0` (미리보기 3초 포함)
5. 사람 한계: 평균 `solveMs / 이동 횟수`가 60ms 미만이면 `verify_failed`. 크기별 최소 시간 미만(4×4 4초, 5×5 8초)도 `verify_failed`. 값은 개발 중 실제로 해 보고 조정할 수 있으며 바꾸면 보고
6. 통과하면 서버가 다시 계산한 `score`로 `bun_submit_score`. DB는 3초 이하를 자동 검토, 경과 시간 불일치(허용 5초)도 검토로 보낸다

**연습 모드 (순위 없음, 횟수 제한 없음)**: 무작위 판(`Math.random` 시드), 크기 3·4·5 선택, "번호 보기" 켜기·끄기, 지난 그림 보관함(일정표에서 **오늘보다 이전 날짜**의 그림만. 오늘 그림과 미래 그림은 절대 보내지 않는다). 지난 그림이 아직 없으면 번호 타일. 연습 기록은 서버로 보내지 않는다.

**그림 파일 규칙**: `public/puzzle/<임의 문자열>.webp` (예 `k3f9a1c7.webp`), 1024×1024, 200KB 이하. 일정표 전체나 미래 날짜의 파일 이름은 클라이언트로 보내지 않는다 (미리 볼 수 없게). 일정표 형식 `{ "YYYY-MM-DD": { "file": "…webp", "id": "puzzle-001" } }`. 빌드 때 남은 일수가 3일 미만이면 경고만 출력한다 (배포를 막지 않음). `scripts/puzzle-status.mjs`로 운영자가 남은 일수를 확인.

**조각 그리기**: 한 장의 그림을 `background-image` + `background-size: n*100%` + `background-position`으로 잘라 보여 준다. 조각 틈은 2px. 서버가 그림을 자르지 않는다.

**공유**: 6-5의 15번 문구와 결과 카드(완성 그림 + 시간). 광고: 플레이 화면에는 없음, 결과 화면 아래쪽에만 (조작 버튼에서 150px 이상).

**사용자용 설명 문구 (15)**
- 하는 법: 시작하면 완성 그림을 3초 보여 줘요. 곧 조각이 섞이니 빈칸 옆 조각을 눌러 밀어서 그림을 맞추세요.
- 규칙: 공식 도전은 하루 한 번이고 맞추는 데 걸린 시간으로 전국 순위를 매겨요. 순위는 매일 0시에 초기화돼요.
- 자주 묻는 질문: 이동 횟수는 순위에 들어가나요? 아니요, 시간만 봐요. / 그림은 누가 만들었나요? 매일 AI로 만든 그림이에요. / 연습은 기록되나요? 연습은 순위에 들어가지 않아요.

### 3단계 (서비스마다 `bun_` 마이그레이션 초안을 먼저 보고)
- 공통 규칙: 테이블·함수 `bun_` 접두어, RLS 켜고 정책 없음, 쓰기는 `bun_` 함수만, `bun_app`에만 실행 권한, `switch.<기능>` 스위치, 30일 보관, Realtime 금지(5~10초 캐시 조회)
- 18 친구 대결방(먼저): `bun_rooms(code, name, game_id, owner_device, created_at, expires_at = +7일)`, `bun_room_members`. 방 순위는 회원들의 `bun_best`로 계산
- 13 가장 작은 유일한 숫자, 11 몇 개일까, 12 다수결, 16 내일 기온: 공용 `bun_daily_picks(game_id, play_date, device_id, value jsonb)` + 마감 시각 집계 작업
- 14 모두의 어항: `bun_fish`(포만감과 갱신 시각만 저장하고 현재 값은 읽을 때 계산), `bun_fish_feeds`. 먹이는 한 함수에서 행 잠금으로 순서대로 처리, 기기당 하루 3회
- 19 퇴근 현황판, 20 점심 집계: 시도·시각만 익명 저장, 5분 단위 집계
- 15 오늘의 한 칸(함께 그리는 캔버스)은 만들지 않는다. 욕설·혐오 그림 검수 부담 때문에 **15번은 오늘의 슬라이드 퍼즐로 교체**했다 (11절)

---

## 12. 운영자용 점검 SQL (README에 그대로 옮길 것)

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

운영 기준(결제 주기 기준): 전송량 150GB에서 대시보드 확인, 220GB에 가까우면 `bun_set_switch('scores', false)`. DB 용량 5GB 경고, 7GB 자동 차단(`bun_guard`. 퀴즈오아시스를 포함한 DB 전체 용량 기준). 같은 IP는 게임별로 1분에 도전 시작 20번, 하루 기기 30대까지. 최근 1분에 서로 다른 IP가 1,500곳을 넘으면 10분 자동 일시정지(회로 차단기, `bun_guard`가 매분 확인).

---

## 13. 하지 말 것

- **퀴즈오아시스 Supabase 프로젝트에 대해 `supabase link`, `supabase db push`, `supabase db reset --linked`, `supabase migration repair`, `supabase db pull`을 실행하지 않는다.** 마이그레이션 기록이 어긋나 퀴즈오아시스 DB가 망가지거나 지워질 수 있다. Supabase CLI는 로컬 DB에만 쓴다
- Vercel Preview·Development 환경에 운영 `BUN_DATABASE_URL` 넣기
- service_role 키 사용 (어떤 경우에도)
- 브라우저 코드에 DB 주소, 비밀번호, service_role 키 넣기
- Supabase Realtime, Supabase 로그인(MAU) 사용
- 원본 IP 저장이나 로그 출력
- 부록 SQL의 함수 이름·인자·반환 형식 변경 (먼저 보고)
- 가격·지명·날씨 데이터 지어내기, 가짜 참여자·가짜 순위 표시
- 광고 자동 새로고침, 조작 버튼 150px 이내 광고, 게임 3·10·14·15 조작 화면 광고, 클릭 유도 문구
- 개발 중 운영 DB(퀴즈오아시스) 접속
- 목업의 기획 노트("사용설명서") 문구를 사용자 화면에 노출
- 공유 문구·링크·이미지에 별명, 기기 ID, IP, 월급·금액 입력값, 정확한 위치를 넣기. 공유를 해야 다음으로 가는 구조, 공유 SDK 추가
- 15번 슬라이드 퍼즐: 일정표 전체나 내일·미래 그림 주소를 클라이언트로 보내기, 연습 모드에 오늘 그림 사용, 사용자가 그림을 올리는 기능
- "MBTI" 같은 상표, 술 벌칙, 도박·카지노 이미지

---

## 부록 A. `supabase/manual/00_bun_role.sql` (부록 B 다음에 수동 1회. 비밀번호 커밋 금지)

```sql
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

alter role bun_app with login password 'REPLACE_WITH_32+_CHAR_RANDOM_PASSWORD';
alter role bun_app connection limit 20;                        -- Micro 직접 연결 60개 중 최대 20개만
alter role bun_app set statement_timeout = '3s';               -- 느린 쿼리가 퀴즈오아시스를 막지 않게
alter role bun_app set idle_in_transaction_session_timeout = '10s';
```

## 부록 B. `supabase/migrations/20261114000001_bun_core.sql`

```sql
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
```

## 부록 C. `supabase/manual/02_bun_cron.sql` (pg_cron 활성화 후)

```sql
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
```

---

## 부록 D. `supabase/migrations/20261118000001_bun_game15.sql` (2단계, 15번 게임 등록)

부록 B 다음에 적용. 15번 행을 비활성 상태로 만든다. 켜는 것은 운영자 (11절).

```sql
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
```
