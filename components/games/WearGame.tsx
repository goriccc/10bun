'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { WearIcon } from '@/components/games/WearIcon';
import { serviceById } from '@/content/services';
import { loadProfile } from '@/lib/device';
import { markDone } from '@/lib/done';
import { wearDefault, wearSidos, wearSpot, wearSpotsIn } from '@/content/wear-points';
import { colderOutfit, wearGenders, wearOutfit, wearStyleOfDay, wearStyles, type WearGender, type WearStyle } from '@/content/wear';
import { chores, swingText, type WearFacts } from '@/lib/games/wear';
import { dateShort } from '@/lib/share';

const service = serviceById(7)!;
const PREF_KEY = '10bun:wear';

type Report = WearFacts & {
  region: string;
  point: string;
};

type WearPref = { gender: WearGender | null; style: WearStyle | null; code: string | null };

function readPref(): WearPref {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { gender: null, style: null, code: null };
    const parsed = JSON.parse(raw) as { gender?: string; style?: string; code?: string };
    const gender = parsed.gender === 'f' || parsed.gender === 'm' ? parsed.gender : null;
    const style = wearStyles.some((item) => item.key === parsed.style) ? (parsed.style as WearStyle) : null;
    const code = typeof parsed.code === 'string' && wearSpot(parsed.code) ? parsed.code : null;
    return { gender, style, code };
  } catch {
    return { gender: null, style: null, code: null };
  }
}

function writePref(pref: WearPref) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ gender: pref.gender, style: pref.style, code: pref.code }));
  } catch {
    return;
  }
}

export function WearGame() {
  const [region, setRegion] = useState('서울');
  const [code, setCode] = useState(wearDefault('서울')?.code ?? '');
  const [report, setReport] = useState<Report | null>(null);
  const [phase, setPhase] = useState<'load' | 'ready' | 'error'>('load');
  const [share, setShare] = useState(false);
  const [prefReady, setPrefReady] = useState(false);
  const [gender, setGender] = useState<WearGender | null>(null);
  const [savedStyle, setSavedStyle] = useState<WearStyle | null>(null);
  const [dayStyle, setDayStyle] = useState<WearStyle>('casual');
  const [shift, setShift] = useState(0);
  const [spotOpen, setSpotOpen] = useState(false);
  const [spotQuery, setSpotQuery] = useState('');
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pref = readPref();
    const profile = loadProfile()?.region;
    const savedSpot = pref.code ? wearSpot(pref.code) : undefined;
    const initial = savedSpot ?? wearDefault(profile && profile !== '미정' ? profile : '서울') ?? wearDefault('서울');
    if (initial) {
      setRegion(initial.sido);
      setCode(initial.code);
    }
    setGender(pref.gender);
    setSavedStyle(pref.style);
    setDayStyle(wearStyleOfDay());
    setPrefReady(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPhase('load');
      void fetch(`/api/bun/weather?code=${encodeURIComponent(code)}`, { signal: controller.signal })
        .then((res) => res.json() as Promise<{ ok?: boolean; report?: Report }>)
        .then((data) => {
          if (!data.ok || !data.report) {
            setReport(null);
            setPhase('error');
            return;
          }
          setReport(data.report);
          setPhase('ready');
          markDone(7);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setReport(null);
          setPhase('error');
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [code]);

  const jobs = report ? chores(report.pop) : null;
  const baseStyle = savedStyle ?? dayStyle;
  const styleIndex = (wearStyles.findIndex((item) => item.key === baseStyle) + shift) % wearStyles.length;
  const style = wearStyles[styleIndex]?.key ?? baseStyle;
  const styleLabel = wearStyles.find((item) => item.key === style)?.label ?? '';
  const genderLabel = wearGenders.find((item) => item.key === gender)?.label ?? '';
  const outfit = report && gender ? wearOutfit(report.temp, gender, style) : null;
  const morning = report && gender && report.high - report.low >= 10 ? colderOutfit(report.temp, gender, style) : null;
  const shareText = report && outfit
    ? `오늘 ${report.point} ${report.temp}°\n${genderLabel} · ${styleLabel}\n${outfit.main}\n${outfit.extra}도 괜찮아요.${report.pop == null ? '' : `\n우산 ${report.pop > 40 ? '챙기세요' : '필요 없음'}`}`
    : '';

  function chooseGender(next: WearGender) {
    setGender(next);
    setShift(0);
    writePref({ gender: next, style: savedStyle, code });
  }

  function chooseStyle(next: WearStyle) {
    if (!gender) return;
    setSavedStyle(next);
    setShift(0);
    writePref({ gender, style: next, code });
  }

  useEffect(() => {
    if (!spotOpen) return;
    function close(event: PointerEvent) {
      if (!spotRef.current?.contains(event.target as Node)) setSpotOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setSpotOpen(false);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [spotOpen]);

  function chooseSido(next: string) {
    const spot = wearDefault(next);
    if (!spot) return;
    setRegion(next);
    setCode(spot.code);
    setSpotOpen(false);
    setSpotQuery('');
    writePref({ gender, style: savedStyle, code: spot.code });
  }

  function chooseSpot(next: string) {
    setCode(next);
    setSpotOpen(false);
    setSpotQuery('');
    writePref({ gender, style: savedStyle, code: next });
  }

  const spots = wearSpotsIn(region).filter((item) => item.name.replace(/\s/g, '').includes(spotQuery.replace(/\s/g, '')));
  const spotName = wearSpot(code)?.name ?? '시·군·구';

  return (
    <GameFrame service={service} revision={0} profile={null} onSave={async () => ({ ok: true })}>
      <div className="wear-layout">
        <div className="day-tabs" role="group" aria-label="동네">
          {wearSidos.map((item) => (
            <button key={item} type="button" aria-pressed={item === region} onClick={() => chooseSido(item)}>
              {item}
            </button>
          ))}
        </div>
        {outfit ? null : <SpotPicker open={spotOpen} query={spotQuery} name={spotName} spots={spots} code={code} boxRef={spotRef} onToggle={() => setSpotOpen((open) => !open)} onQuery={setSpotQuery} onPick={chooseSpot} />}
        {prefReady && !gender ? (
          <div className="wear-card wear-pick">
            <p className="wear-main">여성 차림과 남성 차림 중 어떤 쪽을 볼까요?</p>
            <div className="wear-actions">
              {wearGenders.map((item) => (
                <button key={item.key} className="btn" type="button" onClick={() => chooseGender(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {phase === 'load' ? <p className="hint">동네 예보를 불러오고 있어요.</p> : null}
        {phase === 'error' ? <p className="hint warn">예보를 가져오지 못했어요. 잠시 뒤에 다시 해 주세요.</p> : null}
        {report && phase === 'ready' ? (
          <>
            <p className="hint">{report.region} 예보는 {report.point} 기준이에요.</p>
            {outfit ? (
            <div className="wear-split">
              <div className="wear-card">
                <div className="day-tabs" role="group" aria-label="성별">
                  {wearGenders.map((item) => (
                    <button key={item.key} type="button" aria-pressed={item.key === gender} onClick={() => chooseGender(item.key)}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="day-tabs" role="group" aria-label="스타일">
                  {wearStyles.map((item) => (
                    <button key={item.key} type="button" aria-pressed={item.key === style} onClick={() => chooseStyle(item.key)}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="wear-card-main">
                  <WearIcon kind={outfit.icon} size={140} />
                  <div>
                    <b className="plain">
                      {report.temp}
                      <small>°</small>
                    </b>
                    <p className="wear-main">{outfit.main}</p>
                    <p className="hint">{outfit.extra}도 괜찮아요.</p>
                  </div>
                </div>
                <button className="btn sm" type="button" onClick={() => setShift((value) => (value + 1) % wearStyles.length)}>
                  다른 코디 보기
                </button>
              </div>
              <div className="wear-side">
                <SpotPicker open={spotOpen} query={spotQuery} name={spotName} spots={spots} code={code} boxRef={spotRef} onToggle={() => setSpotOpen((open) => !open)} onQuery={setSpotQuery} onPick={chooseSpot} />
                <div className="panel">
                  <b>
                    {report.point} 오늘 {report.low}° ~ {report.high}°
                  </b>
                  <p className="hint">
                    {swingText(report.low, report.high)}
                    {morning ? ` 아침·저녁엔 ${morning.extra}.` : ''}
                  </p>
                </div>
                {jobs ? (
                  <div className="wear-grid">
                    {jobs.map((job) => (
                      <div key={job.name} className="panel wear-job">
                        <i className={`dot ${job.tone}`} />
                        <b>{job.name}</b>
                        <span>{job.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint">이 시각 예보에는 강수확률이 없어요.</p>
                )}
              </div>
            </div>
            ) : null}
            <HourChart hours={report.hours} />
            <p className="hint">출처: 기상청 단기예보. {dateShort()} 발표분을 1분 동안 같은 값으로 보여요.</p>
            {outfit ? (
              <button className="btn yellow" type="button" onClick={() => setShare(true)}>
                이 카드 보내기
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {share && report ? <ShareSheet slug={service.slug} title={`${report.point} ${report.temp}°`} text={shareText} onClose={() => setShare(false)} /> : null}
    </GameFrame>
  );
}

function SpotPicker({
  open,
  query,
  name,
  spots,
  code,
  boxRef,
  onToggle,
  onQuery,
  onPick,
}: {
  open: boolean;
  query: string;
  name: string;
  spots: { code: string; name: string }[];
  code: string;
  boxRef: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onQuery: (value: string) => void;
  onPick: (code: string) => void;
}) {
  return (
    <div className="wear-spot" ref={boxRef}>
      <button className="wear-spot-btn" type="button" aria-expanded={open} aria-haspopup="listbox" aria-controls="wear-spot-list" onClick={onToggle}>
        <span>{name}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="wear-spot-pop">
          <input className="inp" value={query} placeholder="이름 찾기" aria-label="시·군·구 이름 찾기" onChange={(event) => onQuery(event.target.value)} autoFocus />
          <div className="wear-spot-list" id="wear-spot-list" role="listbox" aria-label="시군구">
            {spots.length === 0 ? <p className="hint">이 시도에는 그 이름이 없어요.</p> : null}
            {spots.map((item) => (
              <button key={item.code} type="button" role="option" aria-selected={item.code === code} onClick={() => onPick(item.code)}>
                {item.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HourChart({ hours }: { hours: { hour: number; temp: number }[] }) {
  if (hours.length === 0) return null;
  const low = Math.min(...hours.map((item) => item.temp));
  const high = Math.max(...hours.map((item) => item.temp));
  const span = Math.max(1, high - low);
  const width = 520;
  const y = (temp: number) => 108 - ((temp - low) / span) * 72;
  const x = (index: number) => (hours.length === 1 ? width / 2 : 36 + (index * (width - 72)) / (hours.length - 1));
  const points = hours.map((item, index) => `${x(index)},${y(item.temp)}`).join(' ');
  return (
    <div className="panel wear-chart">
      <h4>시간대별 기온</h4>
      <svg viewBox={`0 0 ${width} 150`} width="100%" role="img" aria-label="시간대별 기온">
        {hours.length > 1 ? <polyline points={points} fill="none" stroke="#231D4B" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {hours.map((item, index) => (
          <g key={item.hour}>
            <circle cx={x(index)} cy={y(item.temp)} r="6" fill="#FFD13D" stroke="#231D4B" strokeWidth="3" />
            <text x={x(index)} y={y(item.temp) - 12} textAnchor="middle" fontSize="15" fontWeight="700" fill="#231D4B">
              {item.temp}°
            </text>
            <text x={x(index)} y="146" textAnchor="middle" fontSize="13" fill="#5A5486">
              {item.hour}시
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
