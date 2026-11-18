'use client';

import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { useDeviceProfile } from '@/components/useDeviceProfile';
import { serviceById } from '@/content/services';
import { loadDeviceId } from '@/lib/device';
import { markDone } from '@/lib/done';
import { phaseMessage } from '@/lib/phase3-message';

const service = serviceById(13);

type Count = { n?: number; count?: number };
type Board = {
  ok?: boolean;
  open?: boolean;
  participants?: number;
  mine?: { n?: number } | null;
  closed?: { date?: string; result?: { winner?: number | null; participants?: number; counts?: Count[] }; mine?: { n?: number } | null } | null;
};

function msUntilClose(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const target = new Date(`${parts}T22:00:00+09:00`).getTime();
  return target - now.getTime();
}

export function LowestGame() {
  const { profile, needEdit, setNeedEdit, save } = useDeviceProfile();
  const [pick, setPick] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [board, setBoard] = useState<Board | null>(null);
  const [left, setLeft] = useState('--:--:--');
  const [pending, setPending] = useState(false);

  const load = () => {
    const device = loadDeviceId();
    void fetch('/api/bun/pick/13', { headers: device ? { 'x-bun-device': device } : {} })
      .then((res) => res.json())
      .then((data: Board) => setBoard(data))
      .catch(() => setNotice(phaseMessage('bad_request')));
  };

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    const clock = window.setInterval(() => {
      const ms = msUntilClose();
      if (ms <= 0) {
        setLeft('00:00:00');
        return;
      }
      const sec = Math.floor(ms / 1000);
      const pad = (value: number) => String(value).padStart(2, '0');
      setLeft(`${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(clock);
    };
  }, []);

  const submit = async () => {
    const device = loadDeviceId();
    const saved = profile;
    if (!device || !saved || pick == null) return;
    setPending(true);
    try {
      const res = await fetch('/api/bun/pick', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device, nickname: saved.nickname, region: saved.region, gameId: 13, value: { n: pick } }),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string };
      if (!data.ok) {
        setNotice(phaseMessage(data.code ?? 'bad_request'));
        if (data.code === 'bad_nickname' || data.code === 'bad_region') setNeedEdit(true);
      } else {
        markDone(13);
        setNotice(`${pick}을 냈어요. 밤 10시에 결과가 나와요.`);
      }
      load();
    } catch {
      setNotice(phaseMessage('bad_request'));
    } finally {
      setPending(false);
    }
  };

  if (!service) return null;
  const mine = board?.mine?.n;
  const open = board?.open !== false && mine == null;
  const result = board?.closed?.result;
  const counts = (result?.counts ?? []).filter((item) => Number(item.count) > 0).slice(0, 24);
  const max = Math.max(1, ...counts.map((item) => Number(item.count) || 0));

  return (
    <GameFrame service={service} notice={notice} revision={0} profile={profile} needEdit={needEdit} onSave={save}>
      <div className="room-stack">
        <div className="row">
          <span className="lbl">오늘 마감까지</span>
          <b className="room-title">{left}</b>
        </div>
        <div className="num-grid">
          {Array.from({ length: 100 }, (_, index) => index + 1).map((n) => (
            <button key={n} type="button" aria-pressed={pick === n || mine === n} disabled={!open} onClick={() => setPick(n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="form-actions">
          <button className="btn mint" type="button" disabled={!open || pick == null || pending} onClick={() => void submit()}>
            {mine ? `${mine} 제출 완료` : pick ? `${pick} 제출하기` : '숫자를 고르세요'}
          </button>
        </div>
        <p className="hint">
          숫자는 하루 한 번만 낼 수 있어요. 결과는 밤 10시에 발표돼요.
          {board?.ok ? ` 오늘 ${Number(board.participants ?? 0).toLocaleString('ko-KR')}명이 냈어요.` : ''}
        </p>
        {result ? (
          <div className="panel">
            <b>{result.winner ? `지난 승리 숫자 ${result.winner}` : '지난 날에는 한 명만 낸 숫자가 없었어요.'}</b>
            <p className="hint">
              참여 {Number(result.participants ?? 0).toLocaleString('ko-KR')}명
              {board?.closed?.mine?.n ? `. 나는 ${board.closed.mine.n}` : ''}
            </p>
            <div className="count-bins" aria-label="숫자별 제출 수">
              {counts.map((item) => (
                <i key={item.n} style={{ height: `${Math.max(8, ((Number(item.count) || 0) / max) * 100)}%` }} title={`${item.n}`} />
              ))}
            </div>
          </div>
        ) : (
          <p className="hint">아직 발표된 지난 결과가 없어요.</p>
        )}
      </div>
    </GameFrame>
  );
}
