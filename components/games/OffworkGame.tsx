'use client';

import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { useDeviceProfile } from '@/components/useDeviceProfile';
import { regions } from '@/content/regions';
import { serviceById } from '@/content/services';
import { kstDateKey, kstWeekday } from '@/lib/daily';
import { loadDeviceId } from '@/lib/device';
import { markDone } from '@/lib/done';
import { phaseMessage } from '@/lib/phase3-message';

const service = serviceById(19);
const TILES = [
  ['인천', 1, 1], ['서울', 2, 1], ['경기', 3, 1], ['강원', 4, 1],
  ['충남', 1, 2], ['세종', 2, 2], ['충북', 3, 2], ['경북', 4, 2],
  ['전북', 1, 3], ['대전', 2, 3], ['대구', 3, 3], ['울산', 4, 3],
  ['광주', 1, 4], ['전남', 2, 4], ['경남', 3, 4], ['부산', 4, 4],
  ['제주', 1, 5],
] as const;

type Board = { ok?: boolean; weekday?: boolean; total?: number; map?: boolean; regions?: { region?: string; count?: number }[]; hours?: { slot?: string; count?: number }[] };

export function OffworkGame() {
  const { profile, needEdit, setNeedEdit, save } = useDeviceProfile();
  const [region, setRegion] = useState('서울');
  const [board, setBoard] = useState<Board | null>(null);
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);
  const weekend = kstWeekday() === 0 || kstWeekday() === 6;

  const load = () => {
    void fetch('/api/bun/offwork')
      .then((res) => res.json())
      .then((data: Board) => setBoard(data))
      .catch(() => setNotice(phaseMessage('bad_request')));
  };

  useEffect(() => {
    const key = `10bun:offwork:${kstDateKey()}`;
    const timer = window.setTimeout(() => setDone(localStorage.getItem(key) === '1'), 0);
    const poll = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') load();
    }, 10000);
    const start = window.setTimeout(load, 0);
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
    const res = await fetch('/api/bun/offwork', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device, region }),
    });
    const data = (await res.json()) as { ok?: boolean; code?: string };
    if (data.ok || data.code === 'already') {
      localStorage.setItem(`10bun:offwork:${kstDateKey()}`, '1');
      setDone(true);
      markDone(19);
      setNotice(data.ok ? `${region} 퇴근을 기록했어요.` : '오늘은 이미 퇴근을 기록했어요.');
    } else setNotice(phaseMessage(data.code ?? 'bad_request'));
    load();
  };

  if (!service) return null;
  const counts = new Map((board?.regions ?? []).map((item) => [item.region, Number(item.count) || 0]));
  const max = Math.max(1, ...counts.values());
  const slots = board?.hours ?? [];

  return (
    <GameFrame service={service} notice={notice} revision={0} profile={profile} needEdit={needEdit} onSave={save}>
      <div className="room-stack">
        <div className="off-board">
          {board?.ok ? <b>오늘 퇴근을 누른 사람 {Number(board.total ?? 0).toLocaleString('ko-KR')}명</b> : <b>현황을 아직 불러오지 못했어요.</b>}
          {board?.ok && board.map ? (
            <div className="off-map">
              {TILES.map(([name, col, row]) => {
                const count = counts.get(name) ?? 0;
                return (
                  <div key={name} className={name === region ? 'me' : ''} style={{ gridColumn: col, gridRow: row }}>
                    <i style={{ height: `${(count / max) * 100}%` }} />
                    <span>
                      {name}
                      <b>{count}</b>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : board?.ok ? (
            <p className="hint">사람이 더 모이면 시도별 지도가 열려요. 지금은 합계만 보여요.</p>
          ) : null}
        </div>
        <div className="form-stack">
          <label className="field">
            내 시도
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              {regions.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button className="btn orange" type="button" disabled={weekend || done} onClick={() => void tap()}>
              {weekend ? '근무일에 눌러요' : done ? '퇴근 기록 완료' : '나 퇴근!'}
            </button>
          </div>
        </div>
        <div className="count-bins" aria-label="5분 단위 퇴근 수">
          {slots.map((slot) => (
            <i key={slot.slot} title={slot.slot} style={{ height: `${Math.max(8, (Number(slot.count) || 0) * 12)}%` }} />
          ))}
        </div>
        <p className="hint">퇴근 시각과 시도만 익명으로 모아요. 막대는 5분마다의 인원이에요.</p>
      </div>
    </GameFrame>
  );
}
