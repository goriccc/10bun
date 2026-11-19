'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AdSlot } from '@/components/AdSlot';
import { serviceById, services, type Service } from '@/content/services';
import { AD_SLOTS } from '@/content/ads';
import { todaySetIds } from '@/content/today-set';
import { kstDateKey, kstWeekday, msUntilKstMidnight } from '@/lib/daily';
import { loadDone } from '@/lib/done';
import { loadProfile } from '@/lib/device';
import { formatScore } from '@/lib/format';
import { WearIcon, type WearIconName } from '@/components/games/WearIcon';
import { wearOutfit, wearStyleOfDay, wearStyles, type WearGender, type WearStyle } from '@/content/wear';
import { fishKind } from '@/components/games/fish-species';
import { targetSeconds } from '@/lib/games/10sec';
import { taskLabel } from '@/lib/games/shape';
import { hsbCss, todayColors } from '@/lib/games/color';
import { generatePuzzle } from '@/lib/games/number';
import { sizeFor as puzzleSizeFor } from '@/lib/games/puzzle';
import { todayPrices } from '@/lib/games/price';
import { daily, dateFromKey, mulberry32 } from '@/lib/daily';
import { sharedJson } from '@/lib/client-fetch';
import { decayFishFullness, fishToneLabel, formatFishFullness } from '@/lib/fish-fullness';

type Champ = { game_id: number; participants: number; top1: { nickname?: string; score?: number | string } | null };
type Filter = 'all' | 'solo' | 'together' | 'rank';

const DAYS = '일월화수목금토';
const SHARE: Record<number, string> = {
  1: '오차 한 줄',
  2: '점수와 색 줄',
  3: '점수와 그림',
  4: '별점 한 줄',
  5: '화살표 한 줄',
  6: '시간과 별',
  7: '옷차림 카드',
  8: '지금 번 돈',
  9: '단톡방 링크',
  10: '그림 링크',
  17: '지역 순위',
  18: '초대 링크',
  11: '분포 한 줄',
  12: '적중 줄',
  13: '승리 숫자',
  14: '생존 기록',
  15: '시간과 이동',
  16: '오차 한 줄',
  19: '퇴근 기록',
  20: '점심 순위',
};
const LIGHT = new Set(['yellow', 'mint', 'pink', 'orange']);

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function todayLabel(): string {
  const [year, month, day] = kstDateKey().split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${month}월 ${day}일 ${DAYS[weekday]}요일`;
}

export function HomeHub() {
  const [done, setDone] = useState<number[]>([]);
  const [champs, setChamps] = useState<Champ[] | null>(null);
  const [liveFish, setLiveFish] = useState<{ generation: number; alive: boolean; born_at?: string; fullness?: number; syncedAt: number } | null>(null);
  const [liveOff, setLiveOff] = useState<number | null>(null);
  const [clock, setClock] = useState('--:--:--');
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>('all');
  const set = todaySetIds.map((id) => serviceById(id)).filter((item): item is Service => Boolean(item));
  const total = set.reduce((sum, item) => sum + item.minutes, 0);
  const finished = set.filter((item) => done.includes(item.id)).length;
  const next = set.find((item) => !done.includes(item.id)) ?? set[0];

  useEffect(() => {
    const timer = window.setTimeout(() => setDone(loadDone()), 0);
    const tick = () => {
      const sec = Math.max(0, Math.floor(msUntilKstMidnight() / 1000));
      setClock(`${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`);
      setNow(Date.now());
    };
    tick();
    const clockTimer = window.setInterval(tick, 1000);
    const pullFish = () => {
      if (document.visibilityState === 'hidden') return;
      void fetch('/api/bun/fish', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data: { ok?: boolean; fish?: { generation?: number; alive?: boolean; born_at?: string; fullness?: number } }) => {
          if (!data.ok || data.fish?.generation == null) return;
          setLiveFish({
            generation: Number(data.fish.generation),
            alive: data.fish.alive !== false,
            born_at: data.fish.born_at,
            fullness: Number.isFinite(Number(data.fish.fullness)) ? Number(data.fish.fullness) : undefined,
            syncedAt: Date.now(),
          });
        })
        .catch(() => undefined);
    };
    void sharedJson('champions', async () => {
      const res = await fetch('/api/bun/champions');
      return (await res.json()) as { games?: Champ[] };
    })
      .then((data) => setChamps(data.games ?? []))
      .catch(() => setChamps([]));
    pullFish();
    const fishTimer = window.setInterval(pullFish, 8000);
    void sharedJson('offwork', async () => {
      const res = await fetch('/api/bun/offwork');
      return (await res.json()) as { ok?: boolean; total?: number; map?: boolean; regions?: { region?: string; count?: number }[] };
    })
      .then((data) => {
        if (data.ok) setLiveOff(Number(data.total) || 0);
      })
      .catch(() => undefined);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(clockTimer);
      window.clearInterval(fishTimer);
    };
  }, []);

  const openChamps = (champs ?? []).filter((item) => serviceById(item.game_id)?.ranked);
  const live = openChamps.filter((item) => item.top1 && (item.participants ?? 0) > 0).slice(0, 2);
  const liveFull =
    liveFish?.fullness != null && liveFish.alive
      ? decayFishFullness(liveFish.fullness, liveFish.syncedAt, now)
      : liveFish?.alive === false
        ? 0
        : liveFish?.fullness;
  const liveAlive = Boolean(liveFish?.alive) && (liveFull == null || liveFull > 0);
  const fishAge = liveFish?.born_at && liveAlive
    ? (() => {
        const sec = Math.max(0, Math.floor((now - Date.parse(liveFish.born_at)) / 1000));
        const day = Math.floor(sec / 86400);
        const hour = Math.floor((sec % 86400) / 3600);
        if (day > 0) return `${day}일 ${hour}시간`;
        const min = Math.floor((sec % 3600) / 60);
        return hour > 0 ? `${hour}시간 ${min}분` : `${min}분`;
      })()
    : '';
  const shown = services.filter((service) => {
    if (filter === 'solo') return !service.shared;
    if (filter === 'together') return service.shared;
    if (filter === 'rank') return service.ranked;
    return true;
  });

  return (
    <>
      <section className="wrap hero">
        <Timer items={set} done={done} total={total} finished={finished} />
        <div className="hero-copy">
          <h1>오늘의 10분</h1>
          <p>{todayLabel()}. 매일 0시에 문제가 바뀌어요. 아래 네 개를 끝내면 딱 10분 정도 걸립니다.</p>
          <ol className="set-list">
            {set.map((service) => {
              const complete = done.includes(service.id);
              return (
                <li key={service.id} className={complete ? 'done' : ''}>
                  <Link href={`/${service.slug}`}>
                    <span className="dot" style={{ background: `var(--${service.color})` }}>
                      {service.id}
                    </span>
                    <span className="nm">
                      {service.title}
                      <small>{service.line}</small>
                    </span>
                    <span className="st">{complete ? '끝냄' : service.time}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
          {next ? (
            <Link className="btn red" href={`/${next.slug}`}>
              {finished ? '이어서 하기' : '첫 번째 시작하기'}
            </Link>
          ) : null}
        </div>
        <aside className="live" aria-label="지금 다른 사람들">
          <h2>지금 다른 사람들은</h2>
          <p>오늘 1위와 자정 초기화</p>
          {liveFish ? (
            <Link className="live-item" href="/fishbowl">
              <span className="k">
                <i />
                모두의 어항
              </span>
              <span className="v">
                두부 {liveFish.generation}세
                {liveAlive
                  ? `${fishAge ? `, ${fishAge}` : ''}${liveFull != null ? ` · 포만감 ${formatFishFullness(liveFull)}` : ''}${fishToneLabel(liveFull)}`
                  : ' 떠났어요'}
              </span>
            </Link>
          ) : null}
          {liveOff != null ? (
            <Link className="live-item" href="/offwork">
              <span className="k">
                <i />
                퇴근 현황판
              </span>
              <span className="v">오늘 퇴근 {liveOff.toLocaleString('ko-KR')}명</span>
            </Link>
          ) : null}
          {live.map((item) => {
            const service = serviceById(item.game_id);
            const score = Number(item.top1?.score);
            return (
              <Link key={item.game_id} className="live-item" href={`/${service?.slug ?? ''}`}>
                <span className="k">
                  <i />
                  {service?.title}
                </span>
                <span className="v">
                  오늘 1위 {item.top1?.nickname}
                  {Number.isFinite(score) ? `, ${formatScore(item.game_id, score)}` : ''}
                </span>
              </Link>
            );
          })}
          <div className="live-item">
            <span className="k">
              <i />
              0시 초기화까지
            </span>
            <span className="v">{clock}</span>
          </div>
        </aside>
        <AdSlot slot={AD_SLOTS.moHomeLive} device="mobile" className="compact home-ad" />
      </section>
      <section className="wrap">
        <div className="champs">
          <div className="champs-head">
            <div>
              <h2>오늘의 1위</h2>
              <p>매일 0시에 순위가 초기화돼요. 지금 1위 기록에 도전해 보세요.</p>
            </div>
            <div className="champs-reset">
              초기화까지 <b>{clock}</b>
            </div>
          </div>
          <div className="champs-grid">
            {openChamps.map((item) => {
              const service = serviceById(item.game_id);
              const score = Number(item.top1?.score);
              const has = item.participants > 0 && item.top1 && Number.isFinite(score);
              return (
                <Link key={item.game_id} className={`champ g-${service?.color ?? 'red'}`} href={`/${service?.slug ?? ''}`}>
                  <span className="cn">{item.game_id}</span>
                  <span className="t">{service?.title}</span>
                  <span className="r1">{has ? formatScore(item.game_id, score) : '첫 1위가 되어 보세요'}</span>
                  <span className="who">{has ? item.top1?.nickname : `참여 ${item.participants.toLocaleString('ko-KR')}명`}</span>
                </Link>
              );
            })}
          </div>
        </div>
        <AdSlot slot={AD_SLOTS.moHomeChamps} device="mobile" className="compact home-ad" />
        <AdSlot slot={AD_SLOTS.pcHomeChamps} device="desktop" className="compact home-ad" />
      </section>
      <section className="wrap">
        <div className="shelf-bar">
          <div>
            <h2>오늘의 놀이</h2>
            <p>지금 열려 있는 놀이만 골랐어요.</p>
          </div>
          <div className="toggle" role="group" aria-label="보기 선택">
            {(
              [
                ['all', '전체'],
                ['solo', '혼자'],
                ['together', '모두와'],
                ['rank', '순위 경쟁'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="shelf">
          {shelfWithAds(shown, (service) => (
            <Link key={service.id} href={`/${service.slug}`} className={`gadget g-${service.color}`} style={{ ['--span' as string]: service.span }}>
              <div className={`face${LIGHT.has(service.color) ? ' th-dark' : ''}`}>
                <Thumb service={service} fish={liveFish} now={now} />
              </div>
              <div className="meta">
                <span className="no">
                  {service.id}번, {service.group}
                </span>
                <h3>{service.title}</h3>
                <p>{service.line}</p>
                <div className="foot">
                  <span className="chip tm">{service.time}</span>
                  {service.ranked ? <span className="chip rk">전국 순위</span> : null}
                  {service.shared ? <span className="chip srv">서버 집계</span> : service.ranked ? <span className="chip">게임은 서버 없이, 순위만 서버</span> : <span className="chip">서버 없이 동작</span>}
                  <span className="chip">{SHARE[service.id]}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

/** 모바일: 카드 3개마다 / PC: 데스크톱 span 기준 2줄마다 광고. 마지막 카드 뒤에는 넣지 않아 gap 상·하가 대칭. */
function shelfWithAds(list: Service[], render: (service: Service) => ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  let spanSum = 0;
  let rows = 0;
  const last = list.length - 1;
  list.forEach((service, index) => {
    out.push(render(service));
    const hasMore = index < last;
    if (hasMore && (index + 1) % 3 === 0) {
      out.push(<AdSlot key={`mo-shelf-${service.id}-${index}`} slot={AD_SLOTS.moHomeShelf} device="mobile" className="shelf-ad" />);
    }
    spanSum += Math.min(12, Math.max(1, service.span));
    while (spanSum >= 12) {
      spanSum -= 12;
      rows += 1;
      if (hasMore && rows % 2 === 0) {
        out.push(<AdSlot key={`pc-shelf-${service.id}-${rows}`} slot={AD_SLOTS.pcHomeShelf} device="desktop" className="shelf-ad" />);
      }
    }
  });
  return out;
}

function Timer({ items, done, total, finished }: { items: Service[]; done: number[]; total: number; finished: number }) {
  const router = useRouter();
  const [knob, setKnob] = useState('10:00');
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1100);
      const eased = 1 - (1 - p) ** 3;
      const sec = Math.round(eased * 600);
      setKnob(`${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`);
      setSpin((1 - eased) * -120);
      if (p < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const cx = 200;
  const cy = 200;
  const r = 158;
  const point = (angle: number, radius: number) => [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];
  let acc = 0;
  const segs = items.map((service) => {
    const a0 = (acc / total) * Math.PI * 2 + 0.045;
    acc += service.minutes;
    const a1 = (acc / total) * Math.PI * 2 - 0.045;
    const [x0, y0] = point(a0, r);
    const [x1, y1] = point(a1, r);
    const [lx, ly] = point((a0 + a1) / 2, r);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return { service, d: `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`, lx, ly };
  });
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * Math.PI * 2;
    const major = i % 6 === 0;
    const [x0, y0] = point(angle, major ? 122 : 128);
    const [x1, y1] = point(angle, 134);
    return { i, x0, y0, x1, y1, major };
  });
  const nums = Array.from({ length: 10 }, (_, i) => {
    const [x, y] = point((i / 10) * Math.PI * 2, 108);
    return { i, x, y };
  });

  return (
    <div className="timer">
      <div className="timer-ear" />
      <div className="timer-body" />
      <div className="timer-face" />
      <svg className="dial" viewBox="0 0 400 400" aria-label="오늘의 10분 세트 다이얼" style={{ transform: `rotate(${spin}deg)` }}>
        {segs.map(({ service, d, lx, ly }) => (
          <g key={service.id}>
            <path
              className={`seg${done.includes(service.id) ? ' done' : ''}`}
              d={d}
              stroke={`var(--${service.color})`}
              strokeWidth="38"
              fill="none"
              strokeLinecap="butt"
              onClick={() => router.push(`/${service.slug}`)}
            >
              <title>{service.title}</title>
            </path>
            <text x={lx} y={ly + 7} textAnchor="middle" fontFamily="var(--f-disp)" fontSize="21" fill={LIGHT.has(service.color) ? '#231D4B' : '#fff'} pointerEvents="none">
              {service.id}
            </text>
          </g>
        ))}
        {ticks.map((tick) => (
          <line key={tick.i} x1={tick.x0} y1={tick.y0} x2={tick.x1} y2={tick.y1} stroke="#231D4B" strokeOpacity={tick.major ? 0.8 : 0.3} strokeWidth={tick.major ? 3.4 : 1.6} strokeLinecap="round" />
        ))}
        {nums.map((num) => (
          <text key={num.i} x={num.x} y={num.y + 6} textAnchor="middle" fontFamily="var(--f-disp)" fontSize="18" fill="#5A5486">
            {num.i}
          </text>
        ))}
      </svg>
      <div className="timer-knob">
        <div>
          <div className="t">{knob}</div>
          <div className="s">
            {finished}/{items.length} 끝냄
          </div>
        </div>
      </div>
    </div>
  );
}

const JAR_COLS = ['#FF5E5B', '#FFD13D', '#4B5BFF', '#2DCEA2', '#FF8BC6', '#8C6BFF', '#FF9A3D'];
const OFF_TILES = [
  ['인천', 0], ['서울', 1], ['경기', 2], ['강원', 3],
  ['충남', 0], ['세종', 1], ['충북', 2], ['경북', 3],
  ['전북', 0], ['대전', 1], ['대구', 2], ['울산', 3],
  ['광주', 0], ['전남', 1], ['경남', 2], ['부산', 3],
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function blobPath(seed: number): string {
  const rand = mulberry32(seed >>> 0);
  const pts: [number, number][] = [];
  let base = 1;
  for (let k = 0; k < 46; k += 1) {
    base = clamp(base + (rand() - 0.5) * 0.28, 0.62, 1.05);
    const a = (k / 46) * Math.PI * 2;
    const rr = base * (0.86 + rand() * 0.14) * (1 + 0.18 * Math.sin(a * 2 + (seed % 5)));
    pts.push([100 + Math.cos(a) * rr * 72, 100 + Math.sin(a) * rr * 60]);
  }
  return `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
}

function jarDots(count: number): { x: number; y: number; c: number }[] {
  const rand = mulberry32(111);
  const dots: { x: number; y: number; c: number }[] = [];
  let tries = 0;
  while (dots.length < count && tries < count * 30) {
    tries += 1;
    const x = 62 + rand() * 176;
    const y = 96 + rand() * 196;
    const inside = ((x - 150) / 88) ** 2 + ((y - 200) / 104) ** 2 < 1 && y > 110;
    if (!inside) continue;
    const fill = 1 - (y - 96) / 196;
    if (rand() < fill * 0.35 && dots.length > count * 0.6) continue;
    dots.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, c: Math.floor(rand() * JAR_COLS.length) });
  }
  return dots;
}

type LiveFish = { generation: number; alive: boolean; born_at?: string; fullness?: number; syncedAt: number };

function Thumb({ service, fish, now }: { service: Service; fish: LiveFish | null; now: number }) {
  const key = kstDateKey();
  const target = useMemo(() => (service.id === 1 ? targetSeconds(key) : 0), [key, service.id]);
  const colors = useMemo(() => (service.id === 2 ? todayColors(key) : []), [key, service.id]);
  const puzzle = useMemo(() => (service.id === 6 ? generatePuzzle(key) : null), [key, service.id]);
  const jar = useMemo(() => (service.id === 11 ? jarDots(90) : []), [service.id]);
  const lowWin = useMemo(() => {
    if (service.id !== 13) return 9;
    const rand = daily(13, dateFromKey(key));
    return 9 + Math.floor(rand() * 6);
  }, [key, service.id]);
  const blob = useMemo(() => {
    if (service.id !== 5) return '';
    const seed = Number(key.replaceAll('-', '')) % 997 + 3;
    return blobPath(seed);
  }, [key, service.id]);

  if (service.id === 1) {
    return (
      <div className="th">
        <div className="th-big">
          {target.toFixed(2)}
          <small>초</small>
        </div>
        <div className="th-ruler" />
        <small className="cap">오늘의 목표</small>
      </div>
    );
  }
  if (service.id === 2) {
    return (
      <div className="th">
        <div className="th-sw">
          {colors.map((color) => (
            <i key={color.join('-')} style={{ background: hsbCss(color[0], color[1], color[2]) }} />
          ))}
        </div>
        <small className="cap">오늘의 5색</small>
      </div>
    );
  }
  if (service.id === 3) {
    return (
      <div className="th">
        <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
          <circle cx="60" cy="60" r="4" fill="#fff" />
          <path d="M60 14 C90 13 107 34 106 61 C105 90 84 107 58 106 C31 105 13 86 15 58 C16 33 33 15 62 15" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" />
        </svg>
        <small className="cap">{taskLabel(kstWeekday())}</small>
      </div>
    );
  }
  if (service.id === 4) {
    const item = todayPrices(key)[0];
    return (
      <div className="th">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ fontSize: 22, opacity: 0.85 }}>{item.year}</span>
          <span className="th-big" style={{ fontSize: 54 }}>
            ₩{item.price.toLocaleString('ko-KR')}
          </span>
        </div>
        <div style={{ fontSize: 22, marginTop: 6, opacity: 0.9 }}>지금은 얼마?</div>
      </div>
    );
  }
  if (service.id === 5) {
    return (
      <div className="th">
        <svg viewBox="0 0 200 200" width="130" height="130" aria-hidden="true">
          <path d={blob} fill="#fff" />
        </svg>
      </div>
    );
  }
  if (service.id === 6 && puzzle) {
    return (
      <div className="th">
        <div style={{ fontSize: 46, lineHeight: 1, marginBottom: 12 }}>{puzzle.target}</div>
        <div className="th-row">
          {puzzle.nums.slice(0, 4).map((num, index) => (
            <span key={`${num}-${index}`} className="th-tile">
              {num}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (service.id === 15) {
    const n = puzzleSizeFor(key);
    return (
      <div className="th">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${n}, 1fr)`,
            gap: 3,
            width: 120,
            height: 120,
            margin: '0 auto 8px',
          }}
        >
          {Array.from({ length: n * n - 1 }, (_, i) => (
            <i key={i} style={{ background: 'rgba(255,255,255,.92)', borderRadius: 3 }} />
          ))}
          <i style={{ background: 'transparent' }} />
        </div>
        <small className="cap">
          {n}×{n} 슬라이드
        </small>
      </div>
    );
  }
  if (service.id === 7) return <WearThumb />;
  if (service.id === 8) return <EarnThumb />;
  if (service.id === 9) {
    return (
      <div className="th">
        <div className="mini-wheel" />
      </div>
    );
  }
  if (service.id === 10) {
    return (
      <div className="th" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <svg viewBox="0 0 160 110" width="170" height="117" aria-hidden="true">
          <path d="M30 80c-6-30 14-52 40-50 24 2 40 18 44 40M44 34 36 12l20 16M96 32l12-20 4 24M52 58l4 0M88 58l4 0M66 70q8 6 16 0M20 88q60 12 120 0" stroke="#231D4B" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ textAlign: 'left', color: 'var(--ink)' }}>
          <div style={{ fontSize: 58, lineHeight: 0.9 }}>?</div>
          <div style={{ fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 15 }}>친구가 맞히면 승리</div>
        </div>
      </div>
    );
  }
  if (service.id === 11) {
    return (
      <div className="th">
        <svg className="th-jar" viewBox="0 0 300 320" aria-label="사탕이 든 유리병">
          <rect x="100" y="30" width="100" height="34" rx="10" fill="#231D4B" />
          <path d="M110 64h80v18c40 14 66 50 66 104v60c0 42-30 66-106 66S44 288 44 246v-60c0-54 26-90 66-104z" fill="rgba(255,255,255,.55)" stroke="#231D4B" strokeWidth="5" />
          {jar.map((dot) => (
            <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="7" fill={JAR_COLS[dot.c]} stroke="rgba(0,0,0,.18)" strokeWidth="1" />
          ))}
          <path d="M70 150c-6 30-6 70 4 110" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" opacity=".7" />
        </svg>
      </div>
    );
  }
  if (service.id === 12) {
    const bars = [38, 22, 27, 13];
    return (
      <div className="th">
        <div className="th-bars">
          {bars.map((pct, index) => (
            <div key={pct}>
              <div className="col">
                <i className={index === 0 ? 'on' : ''} style={{ height: `${pct * 1.6}%` }} />
              </div>
              <small>{pct}%</small>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (service.id === 13) {
    return (
      <div className="th">
        <div className="th-nums">
          {Array.from({ length: 18 }, (_, index) => {
            const n = index + 1;
            return (
              <span key={n} className={n === lowWin ? 'on' : ''}>
                {n}
              </span>
            );
          })}
        </div>
      </div>
    );
  }
  if (service.id === 14) return <FishThumb fish={fish} now={now} />;
  if (service.id === 16) return <ForecastThumb />;
  if (service.id === 17) {
    const rows = [
      { n: '서울', w: 100 },
      { n: '부산', w: 84 },
      { n: '대구', w: 68 },
      { n: '광주', w: 52 },
    ];
    return (
      <div className="th" style={{ maxWidth: 240, margin: '0 auto', textAlign: 'left' }}>
        {rows.map((row, index) => (
          <div key={row.n} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
            <span style={{ width: 38, fontSize: 18, color: 'var(--ink)' }}>{row.n}</span>
            <i style={{ flex: 1, height: 16, borderRadius: 9, background: index ? 'rgba(255,255,255,.75)' : 'var(--ink)', maxWidth: `${row.w}%` }} />
          </div>
        ))}
      </div>
    );
  }
  if (service.id === 18) {
    return (
      <div className="th th-dark">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          {['#FF5E5B', '#FFD13D', '#4B5BFF', '#2DCEA2', '#FCFBFF'].map((color, index) => (
            <i key={color} style={{ width: 44, height: 44, borderRadius: '50%', background: color, border: '4px solid var(--pink)', marginLeft: index ? -12 : 0, display: 'block' }} />
          ))}
        </div>
        <div style={{ fontSize: 30 }}>방 만들기</div>
        <small style={{ fontFamily: 'var(--f-body)', fontWeight: 600 }}>7일 대결, 같은 문제</small>
      </div>
    );
  }
  if (service.id === 19) return <OffworkThumb />;
  if (service.id === 20) return <LunchThumb />;
  return (
    <div className="th">
      <div className="mini-wheel" />
    </div>
  );
}

function FishThumb({ fish, now }: { fish: LiveFish | null; now: number }) {
  const generation = fish?.generation ?? null;
  const alive = fish?.alive !== false;
  const storedFull = fish?.fullness ?? null;
  const syncedAt = fish?.syncedAt ?? now;
  const color = generation != null ? fishKind(generation).body : '#FF9A3D';
  const liveFull =
    storedFull != null && alive ? decayFishFullness(storedFull, syncedAt, now) : alive ? storedFull : 0;
  const aliveNow = Boolean(fish) && alive && (liveFull == null || liveFull > 0);
  const mark = Math.max(0, Math.min(100, liveFull ?? 0));
  const shownLabel =
    generation == null
      ? '함께 키워요'
      : !aliveNow
        ? `두부 ${generation}세 떠남`
        : `두부 ${generation}세${fishToneLabel(liveFull ?? undefined) || ' 생존 중'}`;

  return (
    <div className="th">
      <div className="th-tank">
        <div className="bed" />
        <div className="fishy" style={{ color, opacity: aliveNow ? 1 : 0.45 }}>
          <svg viewBox="0 0 120 74" width="100%" height="100%" aria-hidden="true">
            <path d="M24 37 L3 15 Q10 37 3 59Z" fill="currentColor" opacity=".9" />
            <path d="M20 37C30 9 80 6 96 32c4 4 4 6 0 10C80 68 30 65 20 37Z" fill="currentColor" />
            <path d="M52 14c8-10 22-10 28 2" fill="currentColor" opacity=".85" />
            <path d="M50 60c6 8 16 8 20 0" fill="currentColor" opacity=".8" />
            <circle cx="82" cy="31" r="6" fill="#fff" />
            <circle cx="83.5" cy="31" r="3" fill="#231D4B" />
          </svg>
        </div>
        <div className="label">{shownLabel}</div>
      </div>
      {liveFull != null ? (
        <div className="th-fish-energy" aria-label={`포만감 ${formatFishFullness(liveFull)}`}>
          <div className="th-fish-gauge">
            <div className="gauge" aria-hidden="true">
              <i style={{ width: '15%', background: 'var(--red)' }} />
              <i style={{ width: '15%', background: 'var(--yellow)' }} />
              <i style={{ width: '50%', background: 'var(--mint)' }} />
              <i style={{ width: '20%', background: 'var(--orange)' }} />
            </div>
            <div className="gauge-mk" style={{ left: `calc(${mark}% - 2px)` }} />
          </div>
          <small className="cap">포만감 {formatFishFullness(liveFull)}</small>
        </div>
      ) : null}
    </div>
  );
}

function ForecastThumb() {
  const saved = loadProfile()?.region;
  const region = saved && saved !== '미정' ? saved : '서울';
  const [temp, setTemp] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch(`/api/bun/weather?region=${encodeURIComponent(region)}`)
        .then((res) => res.json())
        .then((data: { ok?: boolean; report?: { high?: number; temp?: number } }) => {
          if (!data.ok || !data.report) return;
          const value = Number(data.report.high ?? data.report.temp);
          if (Number.isFinite(value)) setTemp(value);
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [region]);
  return (
    <div className="th">
      <div style={{ fontSize: 20, opacity: 0.9 }}>오늘 {region} 최고</div>
      <div className="th-big" style={{ fontSize: 66 }}>
        {temp == null ? '—°' : `${Math.round(temp)}°`}
      </div>
      <small className="cap">기상청보다 정확할까?</small>
    </div>
  );
}

function OffworkThumb() {
  const [lit, setLit] = useState<Set<string>>(new Set());
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void sharedJson('offwork', async () => {
        const res = await fetch('/api/bun/offwork');
        return (await res.json()) as { ok?: boolean; map?: boolean; regions?: { region?: string; count?: number }[] };
      })
        .then((data) => {
          if (!data.ok) return;
          const next = new Set<string>();
          if (data.map) {
            const rows = data.regions ?? [];
            const max = Math.max(1, ...rows.map((row) => Number(row.count) || 0));
            rows.forEach((row) => {
              if (row.region && Number(row.count) / max >= 0.35) next.add(row.region);
            });
          } else {
            OFF_TILES.forEach((tile, index) => {
              if (index % 3 === 0) next.add(tile[0]);
            });
          }
          setLit(next);
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="th">
      <div className="th-map">
        {OFF_TILES.map(([name]) => (
          <i key={name} className={lit.has(name) ? 'lit' : ''} />
        ))}
      </div>
    </div>
  );
}

function LunchThumb() {
  const [rows, setRows] = useState<{ menu: string; count: number }[]>([
    { menu: '김치찌개', count: 100 },
    { menu: '국밥', count: 82 },
    { menu: '돈가스', count: 64 },
  ]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch('/api/bun/lunchrank')
        .then((res) => res.json())
        .then((data: { ok?: boolean; rows?: { menu?: string; count?: number }[] }) => {
          if (!data.ok || !data.rows?.length) return;
          setRows(
            data.rows.slice(0, 3).map((row) => ({
              menu: String(row.menu ?? ''),
              count: Number(row.count) || 0,
            })),
          );
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="th th-dark">
      <div className="th-lunch">
        {rows.map((row, index) => (
          <div key={row.menu} className="row">
            <span className="n">{index + 1}</span>
            <span className="m">{row.menu}</span>
            <i className="b" style={{ width: `${(row.count / max) * 70}px` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EarnThumb() {
  const [bowls, setBowls] = useState('국밥 6.2그릇');
  const [pct, setPct] = useState(58);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('10bun:earned');
        const parsed = raw ? (JSON.parse(raw) as { m?: number; start?: string; end?: string; lunch?: boolean }) : {};
        const m = typeof parsed.m === 'number' ? parsed.m : 320;
        const start = typeof parsed.start === 'string' ? parsed.start : '09:00';
        const end = typeof parsed.end === 'string' ? parsed.end : '18:00';
        const lunch = parsed.lunch !== false;
        const toSec = (value: string) => {
          const [h, min] = value.split(':').map(Number);
          return h * 3600 + min * 60;
        };
        const now = new Date();
        const t = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const s = toSec(start);
        const e = toSec(end);
        const lunch0 = 12 * 3600;
        const lunch1 = 13 * 3600;
        const span = e - s - (lunch && s < lunch0 && e > lunch1 ? 3600 : 0);
        const per = span > 0 ? (m * 10000) / 21.7 / span : 0;
        let worked = Math.min(Math.max(t, s), e) - s;
        if (lunch && t > lunch0) worked -= Math.min(Math.max(t, lunch0), lunch1) - lunch0;
        const earned = Math.max(0, worked * per);
        setBowls(`국밥 ${(earned / 10000).toFixed(1)}그릇`);
        setPct(Math.round(clamp(worked / Math.max(1, span), 0, 1) * 100));
      } catch {
        /* keep sample */
      }
    };
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="th th-dark">
      <div style={{ fontSize: 15, fontFamily: 'var(--f-body)', fontWeight: 700 }}>오늘 지금까지</div>
      <div style={{ fontSize: 40, lineHeight: 1.1 }}>{bowls}</div>
      <div className="bar" style={{ margin: '10px auto 0', maxWidth: 180, background: 'rgba(35,29,75,.15)', height: 10, borderRadius: 999, overflow: 'hidden' }}>
        <i style={{ width: `${pct}%`, background: 'var(--ink)', display: 'block', height: '100%' }} />
      </div>
    </div>
  );
}

function WearThumb() {
  const [temp, setTemp] = useState<number | null>(null);
  const [kind, setKind] = useState<WearIconName>('coat');
  const [label, setLabel] = useState('동네 기온');
  useEffect(() => {
    const saved = loadProfile()?.region;
    const region = saved && saved !== '미정' ? saved : '서울';
    let gender: WearGender | null = null;
    let style: WearStyle | null = null;
    try {
      const raw = localStorage.getItem('10bun:wear');
      const parsed = raw ? (JSON.parse(raw) as { gender?: string; style?: string }) : {};
      gender = parsed.gender === 'f' || parsed.gender === 'm' ? parsed.gender : null;
      style = wearStyles.some((item) => item.key === parsed.style) ? (parsed.style as WearStyle) : null;
    } catch {
      gender = null;
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/bun/weather?region=${encodeURIComponent(region)}`)
        .then((res) => res.json())
        .then((data: { ok?: boolean; report?: { temp: number } }) => {
          if (!data.ok || !data.report) return;
          setTemp(data.report.temp);
          if (!gender) {
            setLabel('성별을 고르면 코디');
            return;
          }
          const outfit = wearOutfit(data.report.temp, gender, style ?? wearStyleOfDay());
          setKind(outfit.icon);
          setLabel(outfit.main);
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="th" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink)' }}>
      <WearIcon kind={kind} size={96} />
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 42, lineHeight: 0.9 }}>{temp == null ? '예보' : `${temp}°`}</div>
        <div style={{ fontFamily: 'var(--f-body)', fontWeight: 700, fontSize: 13 }}>{label}</div>
      </div>
    </div>
  );
}
