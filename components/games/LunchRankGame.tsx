'use client';

import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { useDeviceProfile } from '@/components/useDeviceProfile';
import { LUNCH_MENUS } from '@/content/lunch';
import { regions } from '@/content/regions';
import { serviceById } from '@/content/services';
import { kstDateKey, kstWeekday } from '@/lib/daily';
import { loadDeviceId } from '@/lib/device';
import { markDone } from '@/lib/done';
import { phaseMessage } from '@/lib/phase3-message';

const service = serviceById(20);
const menus = Object.values(LUNCH_MENUS).flat();

type Row = { menu?: string; count?: number };
type Board = { ok?: boolean; weekday?: boolean; total?: number; rows?: Row[] };

export function LunchRankGame() {
  const { profile, needEdit, save } = useDeviceProfile();
  const [menu, setMenu] = useState(menus[0] ?? '');
  const [region, setRegion] = useState('서울');
  const [mine, setMine] = useState('');
  const [board, setBoard] = useState<Board | null>(null);
  const [notice, setNotice] = useState('');
  const weekend = kstWeekday() === 0 || kstWeekday() === 6;

  const load = () => {
    void fetch('/api/bun/lunchrank')
      .then((res) => res.json())
      .then((data: Board) => setBoard(data))
      .catch(() => setNotice(phaseMessage('bad_request')));
  };

  useEffect(() => {
    const saved = localStorage.getItem(`10bun:lunch:${kstDateKey()}`) ?? '';
    const timer = window.setTimeout(() => setMine(saved), 0);
    const start = window.setTimeout(load, 0);
    const poll = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') load();
    }, 10000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(start);
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (profile && (regions as readonly string[]).includes(profile.region)) setRegion(profile.region);
  }, [profile]);

  const tap = async () => {
    const device = loadDeviceId();
    if (!device) {
      setNotice('이 브라우저에는 참여자 이름을 저장할 수 없어요.');
      return;
    }
    const res = await fetch('/api/bun/lunchrank', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device, region, menu }),
    });
    const data = (await res.json()) as { ok?: boolean; code?: string; menu?: string };
    if (data.ok || data.code === 'already') {
      const picked = data.menu || menu;
      localStorage.setItem(`10bun:lunch:${kstDateKey()}`, picked);
      setMine(picked);
      markDone(20);
      setNotice(data.ok ? `${picked}을 기록했어요.` : `오늘은 이미 ${picked}을 기록했어요.`);
    } else setNotice(phaseMessage(data.code ?? 'bad_request'));
    load();
  };

  if (!service) return null;
  const rows = board?.rows ?? [];
  const top = Math.max(1, ...rows.map((row) => Number(row.count) || 0));

  return (
    <GameFrame service={service} notice={notice} revision={0} profile={profile} needEdit={needEdit} onSave={save}>
      <div className="room-stack">
        {board?.ok ? <b>지금 점심 순위 · {Number(board.total ?? 0).toLocaleString('ko-KR')}명</b> : <p className="hint">순위를 아직 불러오지 못했어요.</p>}
        {board?.ok && rows.length === 0 ? <p className="hint">오늘 기록된 점심이 없어요.</p> : null}
        <div className="lunch-list">
          {rows.map((row, index) => (
            <div key={row.menu} className={row.menu === mine ? 'me' : ''}>
              <b>{index + 1}</b>
              <span>{row.menu}</span>
              <i style={{ width: `${((Number(row.count) || 0) / top) * 100}%` }} />
              <em>{Number(row.count || 0).toLocaleString('ko-KR')}</em>
            </div>
          ))}
        </div>
        <div className="panel form-stack lunchrank-form">
          <b>나도 기록하기</b>
          <label className="field">
            메뉴
            <select className="inp" value={menu} onChange={(event) => setMenu(event.target.value)}>
              {menus.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            시도
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              {regions.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button className="btn orange sm" type="button" disabled={weekend || Boolean(mine)} onClick={() => void tap()}>
              {weekend ? '평일 점심에 기록해요' : mine ? '오늘 기록 완료' : '먹었어요'}
            </button>
          </div>
        </div>
      </div>
    </GameFrame>
  );
}
