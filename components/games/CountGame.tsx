'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { useDeviceProfile } from '@/components/useDeviceProfile';
import { serviceById } from '@/content/services';
import { kstDateKey, shiftDateKey } from '@/lib/daily';
import { loadDeviceId } from '@/lib/device';
import { todayJar } from '@/lib/games/count';
import { phaseMessage } from '@/lib/phase3-message';
import { markDone } from '@/lib/done';

const service = serviceById(11);
const COLORS = ['#FF5E5B', '#FFD13D', '#4B5BFF', '#2DCEA2', '#FF8BC6', '#8C6BFF', '#FF9A3D'];

type Dot = { x: number; y: number; c: number };
type Bin = { lo?: number; hi?: number; count?: number };
type Closed = { date?: string; result?: { answer?: number; participants?: number; median?: number | null; bins?: Bin[] }; mine?: { guess?: number } | null };
type Board = { ok?: boolean; code?: string; participants?: number; mine?: { guess?: number } | null; closed?: Closed | null };

type Fly = Dot & { id: number; mx: number; my: number; tx: number; ty: number; dur: number };

const MOUTH_X = 150;
const MOUTH_Y = 70;

function JarCandies({
  dots,
  label,
  open = false,
  flying = [],
}: {
  dots: Dot[];
  label: string;
  open?: boolean;
  flying?: Fly[];
}) {
  return (
    <svg className={`jar-svg${open ? ' jar-open' : ''}`} viewBox={open ? '0 0 300 340' : '0 0 300 320'} role="img" aria-label={label}>
      {open ? (
        <g transform="translate(48 2) rotate(-32)">
          <rect x="0" y="0" width="100" height="34" rx="10" fill="#231D4B" />
        </g>
      ) : (
        <rect x="100" y="30" width="100" height="34" rx="10" fill="#231D4B" />
      )}
      {open ? <ellipse cx="150" cy="72" rx="38" ry="10" fill="#231D4B" opacity=".35" /> : null}
      <path d="M110 64h80v18c40 14 66 50 66 104v60c0 42-30 66-106 66S44 288 44 246v-60c0-54 26-90 66-104z" fill="rgba(255,255,255,.55)" stroke="#231D4B" strokeWidth="5" />
      {dots.map((dot, index) => (
        <circle key={`${dot.x}-${dot.y}-${index}`} className="candy" cx={dot.x} cy={dot.y} r="7" fill={COLORS[dot.c] ?? COLORS[0]} stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      ))}
      <path d="M70 150c-6 30-6 70 4 110" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" opacity=".7" />
      {flying.map((dot) => (
        <circle
          key={dot.id}
          className="candy-fly"
          cx={dot.x}
          cy={dot.y}
          r="7"
          fill={COLORS[dot.c] ?? COLORS[0]}
          stroke="rgba(0,0,0,.18)"
          strokeWidth="1"
          style={
            {
              ['--mx']: `${dot.mx}px`,
              ['--my']: `${dot.my}px`,
              ['--tx']: `${dot.tx}px`,
              ['--ty']: `${dot.ty}px`,
              animationDuration: `${dot.dur}ms`,
            } as CSSProperties
          }
        />
      ))}
    </svg>
  );
}

function PastJarReveal({ date, answer }: { date: string; answer: number }) {
  const dots = useMemo(() => todayJar(date).dots, [date]);
  // 위(입구 쪽)부터 빼서 아래로 줄어들게
  const ordered = useMemo(() => dots.slice().sort((a, b) => a.y - b.y || a.x - b.x), [dots]);
  const total = ordered.length;
  const [taken, setTaken] = useState(0);
  const [flying, setFlying] = useState<Fly[]>([]);
  const [running, setRunning] = useState(true);
  const [pass, setPass] = useState(0);
  const reduced = useRef(false);
  const flyId = useRef(0);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    setTaken(0);
    setFlying([]);
    setRunning(true);
    flyId.current = 0;
  }, [date, pass]);

  useEffect(() => {
    if (!running) return;
    if (reduced.current || total <= 0) {
      setTaken(total);
      setFlying([]);
      setRunning(false);
      return;
    }
    if (taken >= total) {
      setRunning(false);
      return;
    }
    const stepMs = Math.max(8, Math.min(20, Math.floor(2600 / Math.max(1, total))));
    const timer = window.setTimeout(() => {
      const candy = ordered[taken];
      if (!candy) {
        setRunning(false);
        return;
      }
      const id = ++flyId.current;
      const mouthX = MOUTH_X + (Math.random() * 10 - 5);
      const mouthY = MOUTH_Y + (Math.random() * 6 - 2);
      const exitX = mouthX + 8 + Math.random() * 28;
      const exitY = 6 + Math.random() * 18;
      const rise = Math.max(40, candy.y - mouthY);
      const dur = Math.round(480 + rise * 0.7);
      const next: Fly = {
        ...candy,
        id,
        mx: mouthX - candy.x,
        my: mouthY - candy.y,
        tx: exitX - candy.x,
        ty: exitY - candy.y,
        dur,
      };
      setFlying((list) => [...list.slice(-36), next]);
      setTaken((value) => value + 1);
      window.setTimeout(() => {
        setFlying((list) => list.filter((item) => item.id !== id));
      }, dur);
    }, stepMs);
    return () => window.clearTimeout(timer);
  }, [running, taken, total, ordered]);

  const visible = ordered.slice(taken);
  const count = Math.min(taken, Math.max(answer, total));
  const done = !running && taken >= total;

  return (
    <div className="count-reveal">
      <JarCandies
        open
        dots={visible}
        flying={flying}
        label={done ? `지난 병, 정답 ${answer}개` : '지난 병에서 사탕을 꺼내는 중'}
      />
      <div className="count-tally" aria-live="polite">
        <b key={count}>
          {count.toLocaleString('ko-KR')}
          <small>개</small>
        </b>
        {done ? (
          <div className="count-tally-done">
            <span className="hint">다 세었어요</span>
            <button className="btn sm ghost" type="button" onClick={() => setPass((value) => value + 1)}>
              다시 세기
            </button>
          </div>
        ) : (
          <span className="hint">위에서부터 꺼내며 세는 중</span>
        )}
      </div>
    </div>
  );
}

export function CountGame({ dots }: { dots: Dot[] }) {
  const { profile, needEdit, setNeedEdit, save } = useDeviceProfile();
  const [guess, setGuess] = useState('');
  const [notice, setNotice] = useState('');
  const [board, setBoard] = useState<Board | null>(null);
  const [pending, setPending] = useState(false);
  const [share, setShare] = useState('');

  const load = () => {
    const device = loadDeviceId();
    void fetch('/api/bun/pick/11', { headers: device ? { 'x-bun-device': device } : {} })
      .then((res) => res.json())
      .then((data: Board) => setBoard(data))
      .catch(() => setNotice(phaseMessage('bad_request')));
  };

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = async () => {
    const device = loadDeviceId();
    const saved = profile;
    const value = Number(guess);
    if (!device || !saved) {
      setNotice('이 브라우저에는 참여자 이름을 저장할 수 없어요.');
      return;
    }
    if (!Number.isInteger(value) || value < 1 || value > 5000) {
      setNotice('1개에서 5,000개 사이로 적어 주세요.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/bun/pick', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device, nickname: saved.nickname, region: saved.region, gameId: 11, value: { guess: value } }),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string };
      if (!data.ok) {
        setNotice(phaseMessage(data.code ?? 'bad_request'));
        if (data.code === 'bad_nickname' || data.code === 'bad_region') setNeedEdit(true);
      } else {
        markDone(11);
        setNotice('냈어요. 내일 0시에 정답과 전국 중앙값이 나와요.');
      }
      load();
    } catch {
      setNotice(phaseMessage('bad_request'));
    } finally {
      setPending(false);
    }
  };

  if (!service) return null;
  const mine = board?.mine?.guess;
  const closed = board?.closed?.result;
  const answer = Number(closed?.answer);
  const median = closed?.median == null ? null : Number(closed.median);
  const myClosed = board?.closed?.mine?.guess;
  const bins = closed?.bins ?? [];
  const maxBin = Math.max(1, ...bins.map((bin) => Number(bin.count) || 0));
  const pastDate =
    typeof board?.closed?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(board.closed.date)
      ? board.closed.date
      : shiftDateKey(kstDateKey(), -1);

  return (
    <>
      <GameFrame service={service} notice={notice} revision={0} profile={profile} needEdit={needEdit} onSave={save}>
        <div className="count-split">
          <JarCandies dots={dots} label="오늘 사탕이 든 유리병" />
          <div className="room-stack">
            <h2 className="room-title">병 속 사탕은 몇 개?</h2>
            <p className="hint">세지 말고 감으로. 정답과 전국 중앙값은 내일 0시에 공개돼요.</p>
            {mine ? (
              <div className="panel">
                <b>제출 완료: {mine.toLocaleString('ko-KR')}개</b>
                <p className="hint">오늘 {Number(board?.participants ?? 0).toLocaleString('ko-KR')}명이 냈어요.</p>
              </div>
            ) : (
              <form
                className="row c"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <input className="inp" inputMode="numeric" value={guess} placeholder="개수 입력" onChange={(event) => setGuess(event.target.value.replace(/[^0-9]/g, ''))} />
                <button className="btn mint" type="submit" disabled={pending}>
                  제출
                </button>
              </form>
            )}
            {closed && Number.isFinite(answer) ? (
              <div className="panel count-past">
                <b>지난 결과</b>
                <PastJarReveal date={pastDate} answer={answer} />
                <p className="hint">
                  정답 {answer.toLocaleString('ko-KR')}개
                  {median != null && Number.isFinite(median) ? `, 전국 중앙값 ${Math.round(median).toLocaleString('ko-KR')}개` : ''}
                  {myClosed ? `, 나는 ${myClosed.toLocaleString('ko-KR')}개` : ''}
                </p>
                {bins.length > 0 ? (
                  <div className="count-bins" aria-label="추정 분포">
                    {bins.map((bin) => (
                      <i key={`${bin.lo}-${bin.hi}`} style={{ height: `${Math.max(8, ((Number(bin.count) || 0) / maxBin) * 100)}%` }} />
                    ))}
                  </div>
                ) : null}
                {myClosed ? (
                  <div className="form-actions">
                    <button className="btn sm" type="button" onClick={() => setShare(`몇 개일까\n정답 ${answer}개, 나는 ${myClosed}개`)}>
                      결과 공유
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="hint">아직 공개된 지난 결과가 없어요.</p>
            )}
          </div>
        </div>
      </GameFrame>
      {share ? <ShareSheet slug="count" title="몇 개일까" text={share} onClose={() => setShare('')} /> : null}
    </>
  );
}
