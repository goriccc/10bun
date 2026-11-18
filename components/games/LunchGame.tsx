'use client';

import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { LUNCH_BUDGETS, LUNCH_MENUS, WHEEL_COLORS } from '@/content/lunch';
import { serviceById } from '@/content/services';
import { kstDateKey } from '@/lib/daily';
import { markDone } from '@/lib/done';
import { lunchHref, menusFor, mondayKey, readLunch, type LunchLink } from '@/lib/games/lunch';
import { dateShort } from '@/lib/share';

const service = serviceById(9)!;

export function LunchGame() {
  const [budget, setBudget] = useState(0);
  const [veto, setVeto] = useState<number[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [share, setShare] = useState(false);
  const [note, setNote] = useState('');
  const [canVeto, setCanVeto] = useState(false);
  const [week, setWeek] = useState<string[]>([]);
  useEffect(() => {
    setWeek(loadWeek());
    const incoming = readLunch(window.location.search);
    if (!incoming) return;
    setBudget(incoming.budget);
    setVeto(incoming.veto);
    setPick(incoming.pick);
    setCanVeto(Boolean(incoming.unused && incoming.pick != null));
    if (incoming.pick != null) setNote('받은 메뉴예요. 싫으면 거부권을 한 번 쓸 수 있어요.');
  }, []);

  const names = menusFor(budget, veto);
  const all = LUNCH_MENUS[LUNCH_BUDGETS[budget]];
  const currentName = pick == null ? '' : all[pick];
  const hidden = week.filter((menu) => menu !== currentName && all.includes(menu));
  const wheelNames = names.filter((menu) => !hidden.includes(menu));
  const shown = wheelNames.length > 0 ? wheelNames : names;

  const spin = (nextVeto = veto, nextBudget = budget) => {
    const pool = menusFor(nextBudget, nextVeto).filter((menu) => !loadWeek().includes(menu));
    const usable = pool.length > 0 ? pool : menusFor(nextBudget, nextVeto);
    if (usable.length === 0) {
      setNote('남은 메뉴가 없어요. 예산을 바꿔 보세요.');
      return;
    }
    const menu = usable[Math.floor(Math.random() * usable.length)];
    const index = LUNCH_MENUS[LUNCH_BUDGETS[nextBudget]].indexOf(menu);
    const slice = 360 / usable.length;
    const order = usable.indexOf(menu);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setSpinning(true);
    setPick(null);
    setRotation((value) => value + 360 * (reduce ? 0 : 5) + (360 - (order + 0.5) * slice));
    window.setTimeout(() => {
      setPick(index);
      setSpinning(false);
      setCanVeto(false);
      setWeek(remember(menu));
      markDone(9);
    }, reduce ? 0 : 3400);
  };

  const vetoPick = () => {
    if (pick == null || !canVeto) return;
    const next = [...veto, pick];
    setVeto(next);
    setCanVeto(false);
    setNote('거부권을 썼어요. 다시 돌려요.');
    spin(next, budget);
  };

  const link: LunchLink = { budget, veto, pick, unused: true };
  const menuName = pick == null ? '' : all[pick];

  return (
    <GameFrame service={service} revision={0} profile={null} onSave={async () => ({ ok: true })}>
      <div className="g-center">
        <div className="day-tabs" role="group" aria-label="1인 예산">
          {LUNCH_BUDGETS.map((label, index) => (
            <button
              key={label}
              type="button"
              aria-pressed={index === budget}
              onClick={() => {
                setBudget(index);
                setVeto([]);
                setPick(null);
                setRotation(0);
                setCanVeto(false);
                setNote('');
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="wheel" aria-hidden="true">
          <i className="wheel-pin" />
          <svg viewBox="0 0 300 300">
            <circle cx="150" cy="150" r="148" fill="#fff" />
            <g style={{ transformOrigin: '150px 150px', transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 3.4s cubic-bezier(.12,.75,.1,1)' : 'none' }}>
              <Wheel names={shown} />
            </g>
            <circle cx="150" cy="150" r="22" fill="#fff" stroke="#231D4B" strokeWidth="5" />
          </svg>
        </div>
        <button className="btn yellow xl" type="button" disabled={spinning || shown.length === 0} onClick={() => spin()}>
          돌리기
        </button>
        {note ? <p className="hint">{note}</p> : null}
        {menuName && !spinning ? (
          <div className="panel" role="status">
            <span className="lbl">오늘 점심은</span>
            <b className="plain">{menuName}</b>
            <p className="hint">가게는 정하지 않아요. 메뉴만 고르고, 싫으면 링크에서 한 번 바꿀 수 있어요.</p>
            <div className="form-actions">
              {canVeto ? (
                <button className="btn sm ghost" type="button" onClick={vetoPick}>
                  이 메뉴 거부하고 다시 돌리기
                </button>
              ) : null}
              <button className="btn sm" type="button" onClick={() => setShare(true)}>
                링크 보내기
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {share && menuName ? (
        <ShareSheet
          slug={service.slug}
          title={`오늘은 ${menuName}`}
          text={`오늘 점심은 ${menuName}\n${dateShort()} ${LUNCH_BUDGETS[budget]}\n싫으면 링크에서 거부권을 한 번 쓸 수 있어요.`}
          linkFor={(medium) => lunchHref(link, medium, kstDateKey())}
          onClose={() => setShare(false)}
        />
      ) : null}
    </GameFrame>
  );
}

function Wheel({ names }: { names: string[] }) {
  const slice = 360 / Math.max(1, names.length);
  return (
    <>
      {names.map((menu, index) => {
        const start = ((index * slice - 90) * Math.PI) / 180;
        const end = (((index + 1) * slice - 90) * Math.PI) / 180;
        const large = slice > 180 ? 1 : 0;
        const x0 = 150 + 140 * Math.cos(start);
        const y0 = 150 + 140 * Math.sin(start);
        const x1 = 150 + 140 * Math.cos(end);
        const y1 = 150 + 140 * Math.sin(end);
        const mid = (index + 0.5) * slice;
        const light = [1, 3, 4, 6].includes(index % 8);
        return (
          <g key={menu}>
            <path d={`M150 150 L${x0} ${y0} A140 140 0 ${large} 1 ${x1} ${y1} Z`} fill={WHEEL_COLORS[index % WHEEL_COLORS.length]} />
            <text transform={`rotate(${mid} 150 150) translate(150 62)`} textAnchor="middle" fontFamily="var(--f-disp)" fontSize={names.length > 7 ? 15 : 18} fill={light ? '#231D4B' : '#fff'}>
              {menu}
            </text>
          </g>
        );
      })}
    </>
  );
}

function loadWeek(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`10bun:lunch:${mondayKey()}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function remember(menu: string): string[] {
  const key = `10bun:lunch:${mondayKey()}`;
  const next = [...new Set([...loadWeek(), menu])];
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* 저장을 막아도 돌림판은 동작해요 */
  }
  return next;
}
