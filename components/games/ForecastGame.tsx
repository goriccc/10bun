'use client';

import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { useDeviceProfile } from '@/components/useDeviceProfile';
import { regions } from '@/content/regions';
import { serviceById } from '@/content/services';
import { loadDeviceId } from '@/lib/device';
import { markDone } from '@/lib/done';
import { phaseMessage } from '@/lib/phase3-message';

const service = serviceById(16);

type Board = {
  open?: boolean;
  participants?: number;
  mine?: { region?: string; guess?: number } | null;
  closed?: { result?: { region?: string; guess?: number; high?: number; error?: number; rank?: number; participants?: number; pending?: boolean } } | null;
};

export function ForecastGame() {
  const { profile, needEdit, setNeedEdit, save } = useDeviceProfile();
  const [region, setRegion] = useState('서울');
  const [guess, setGuess] = useState(15);
  const [hint, setHint] = useState('');
  const [notice, setNotice] = useState('');
  const [board, setBoard] = useState<Board | null>(null);
  const [pending, setPending] = useState(false);

  const load = () => {
    const device = loadDeviceId();
    void fetch('/api/bun/pick/16', { headers: device ? { 'x-bun-device': device } : {} })
      .then((res) => res.json())
      .then((data: Board) => {
        setBoard(data);
        if (data.mine?.region && data.mine.guess != null) {
          setRegion(data.mine.region);
          setGuess(Number(data.mine.guess));
        }
      })
      .catch(() => setNotice(phaseMessage('bad_request')));
  };

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      void fetch(`/api/bun/weather?region=${encodeURIComponent(region)}`)
        .then((res) => res.json())
        .then((data: { ok?: boolean; report?: { high?: number } }) => {
          if (!live) return;
          if (data.ok && typeof data.report?.high === 'number') setHint(`오늘 ${region} 최고는 ${data.report.high}°예요.`);
          else setHint('');
        })
        .catch(() => {
          if (live) setHint('');
        });
    }, 0);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [region]);

  const submit = async () => {
    const device = loadDeviceId();
    const saved = profile;
    if (!device || !saved) {
      setNotice('이 브라우저에는 참여자 이름을 저장할 수 없어요.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/bun/pick', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device, nickname: saved.nickname, region: saved.region, gameId: 16, value: { region, guess: Math.round(guess * 10) / 10 } }),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string };
      if (!data.ok) {
        setNotice(phaseMessage(data.code ?? 'bad_request'));
        if (data.code === 'bad_nickname' || data.code === 'bad_region') setNeedEdit(true);
      } else {
        markDone(16);
        setNotice(`${region} ${guess.toFixed(1)}°로 예측했어요. 내일 저녁 6시에 기상청 단기예보와 비교해요.`);
      }
      load();
    } catch {
      setNotice(phaseMessage('bad_request'));
    } finally {
      setPending(false);
    }
  };

  if (!service) return null;
  const locked = board?.open === false;
  const yesterday = board?.closed?.result;

  return (
    <GameFrame service={service} notice={notice} revision={0} profile={profile} needEdit={needEdit} onSave={save}>
      <div className="room-stack">
        <div className="room-games">
          {regions.map((name) => (
            <button key={name} type="button" aria-pressed={name === region} disabled={locked} onClick={() => setRegion(name)}>
              {name}
            </button>
          ))}
        </div>
        <span className="lbl">내일 {region} 최고기온 예측</span>
        <div className="room-title">{guess.toFixed(1)}°</div>
        <input type="range" min={-15} max={40} step={0.1} value={guess} disabled={locked} aria-label="예측 기온" onChange={(event) => setGuess(Number(event.target.value))} />
        <div className="form-actions">
          <button className="btn violet" type="button" disabled={locked || pending} onClick={() => void submit()}>
            {locked ? '오늘 예측은 마감됐어요' : board?.mine ? '이 기온으로 바꾸기' : '이 기온으로 예측'}
          </button>
        </div>
        <p className="hint">{hint || '0.1° 단위. 저녁 6시 전까지 바꿀 수 있어요.'}</p>
        {yesterday?.pending ? <p className="hint">어제 예측은 저장됐고, 오늘 저녁 6시 이후에 채점해요.</p> : null}
        {yesterday && yesterday.high != null ? (
          <div className="panel">
            <b>어제 예측 채점</b>
            <p>
              {yesterday.region} 예측 {Number(yesterday.guess).toFixed(1)}°, 기상청 단기예보 {Number(yesterday.high).toFixed(1)}°, 차이 {Number(yesterday.error).toFixed(1)}°
            </p>
            <p className="hint">
              같은 시도 {Number(yesterday.participants ?? 0).toLocaleString('ko-KR')}명 중 {Number(yesterday.rank ?? 0).toLocaleString('ko-KR')}번째예요.
            </p>
          </div>
        ) : null}
      </div>
    </GameFrame>
  );
}
