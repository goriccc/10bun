'use client';

import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { serviceById } from '@/content/services';
import { dateShort } from '@/lib/share';

const service = serviceById(8)!;
const goods = [
  ['치킨', 20000, '마리'],
  ['국밥', 10000, '그릇'],
  ['아메리카노', 4500, '잔'],
  ['영화표', 15000, '장'],
] as const;

type Pay = { m: number; start: string; end: string; lunch: boolean };

function loadPay(): Pay {
  try {
    const raw = localStorage.getItem('10bun:earned');
    if (!raw) return { m: 320, start: '09:00', end: '18:00', lunch: true };
    const parsed = JSON.parse(raw) as Partial<Pay>;
    return {
      m: typeof parsed.m === 'number' ? parsed.m : 320,
      start: typeof parsed.start === 'string' ? parsed.start : '09:00',
      end: typeof parsed.end === 'string' ? parsed.end : '18:00',
      lunch: parsed.lunch !== false,
    };
  } catch {
    return { m: 320, start: '09:00', end: '18:00', lunch: true };
  }
}

function seconds(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 3600 + m * 60;
}

export function EarnedGame() {
  const [pay, setPay] = useState<Pay | null>(null);
  const [now, setNow] = useState(0);
  const [share, setShare] = useState(false);

  useEffect(() => {
    const readNow = () => {
      const date = new Date();
      return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
    };
    const timer = window.setTimeout(() => setPay(loadPay()), 0);
    const clock = window.setInterval(() => setNow(readNow()), 1000);
    const first = window.setTimeout(() => setNow(readNow()), 0);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(first);
      window.clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    if (!pay) return;
    try {
      localStorage.setItem('10bun:earned', JSON.stringify(pay));
    } catch {
      /* 이 기기에만 저장한다 */
    }
  }, [pay]);

  if (!pay) return null;
  const start = seconds(pay.start);
  const end = seconds(pay.end);
  const lunch0 = 12 * 3600;
  const lunch1 = 13 * 3600;
  const span = end - start - (pay.lunch && start < lunch0 && end > lunch1 ? 3600 : 0);
  const perSecond = span > 0 ? (pay.m * 10000) / 21.7 / span : 0;
  let worked = Math.min(Math.max(now, start), end) - start;
  if (pay.lunch && now > lunch0) worked -= Math.min(Math.max(now, lunch0), lunch1) - lunch0;
  const earned = Math.max(0, worked * perSecond);
  const left = Math.max(0, end - now);
  const label = now < start ? '출근 전이에요' : now > end ? '오늘 근무가 끝났어요' : '오늘 지금까지 번 돈';
  const text = `오늘 지금까지\n국밥 ${(earned / 10000).toFixed(1)}그릇, 아메리카노 ${Math.floor(earned / 4500)}잔 벌었다${left > 0 && now >= start ? `\n퇴근까지 ${Math.floor(left / 3600)}시간 ${Math.floor((left % 3600) / 60)}분` : ''}`;

  return (
    <GameFrame service={service} revision={0} profile={null} onSave={async () => ({ ok: true })}>
      <div className="earn">
        <div className="row">
          <label className="field">
            월급 (만원)
            <input
              type="number"
              min={50}
              max={5000}
              value={pay.m}
              onChange={(event) => setPay({ ...pay, m: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            출근
            <input type="time" value={pay.start} onChange={(event) => setPay({ ...pay, start: event.target.value })} />
          </label>
          <label className="field">
            퇴근
            <input type="time" value={pay.end} onChange={(event) => setPay({ ...pay, end: event.target.value })} />
          </label>
          <label className="field inline">
            <input type="checkbox" checked={pay.lunch} onChange={(event) => setPay({ ...pay, lunch: event.target.checked })} /> 점심 1시간 빼기
          </label>
        </div>
        <div className="earn-board">
          <div>{label}</div>
          <b>₩{Math.round(earned).toLocaleString('ko-KR')}</b>
          <p className="hint">{left > 0 && now >= start ? `퇴근까지 ${Math.floor(left / 3600)}시간 ${Math.floor((left % 3600) / 60)}분` : dateShort()}</p>
        </div>
        <div className="goods">
          {goods.map(([name, price, unit]) => (
            <div key={name} className="panel">
              <b>{(earned / price).toFixed(1)}</b>
              <span>
                {name} {unit}
              </span>
            </div>
          ))}
        </div>
        <button className="btn yellow" type="button" onClick={() => setShare(true)}>
          물건으로 공유하기
        </button>
        <p className="hint">입력값은 이 기기에만 저장되고 어디로도 보내지 않아요. 하루 근무일은 월 21.7일로 계산해요.</p>
      </div>
      {share ? <ShareSheet slug={service.slug} title={`국밥 ${(earned / 10000).toFixed(1)}그릇`} text={text} onClose={() => setShare(false)} /> : null}
    </GameFrame>
  );
}
