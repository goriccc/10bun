'use client';

import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { useDeviceProfile } from '@/components/useDeviceProfile';
import { serviceById } from '@/content/services';
import { kstDateKey } from '@/lib/daily';
import { loadDeviceId } from '@/lib/device';
import { markDone } from '@/lib/done';
import { majorityOrder, majorityQuestions } from '@/lib/games/majority';
import { phaseMessage } from '@/lib/phase3-message';

const service = serviceById(12);

type QuestionResult = { counts?: number[]; winner?: number };
type Board = { ok?: boolean; code?: string; mine?: { choices?: number[] } | null; closed?: { result?: { questions?: QuestionResult[]; participants?: number }; mine?: { choices?: number[] } | null } | null };

function Shape({ kind }: { kind: string }) {
  if (kind === 'circle') return <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="currentColor" /></svg>;
  if (kind === 'star') return <svg viewBox="0 0 100 100"><path fill="currentColor" d="M50 12l10 26 28 2-22 18 8 28-24-16-24 16 8-28-22-18 28-2z" /></svg>;
  if (kind === 'round') return <svg viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" rx="18" fill="currentColor" /></svg>;
  return <svg viewBox="0 0 100 100"><path fill="currentColor" d="M50 84C20 62 12 48 14 34c2-14 20-22 36-6 16-16 34-8 36 6 2 14-6 28-36 50z" /></svg>;
}

function Pattern({ kind }: { kind: string }) {
  const background =
    kind === 'stripe'
      ? 'repeating-linear-gradient(45deg,#4B5BFF 0 12px,#fff 12px 24px)'
      : kind === 'dot'
        ? 'radial-gradient(circle,#FF5E5B 7px,#FFF3F0 8px) 0 0/28px 28px'
        : kind === 'check'
          ? 'conic-gradient(#231D4B 25%,#FFD13D 0 50%,#231D4B 0 75%,#FFD13D 0) 0 0/36px 36px'
          : 'repeating-radial-gradient(circle at 0 100%,#2DCEA2 0 10px,#E5FBF4 10px 20px)';
  return <div style={{ width: '100%', height: '100%', background }} />;
}

export function MajorityGame() {
  const { profile, needEdit, setNeedEdit, save } = useDeviceProfile();
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [notice, setNotice] = useState('');
  const [board, setBoard] = useState<Board | null>(null);
  const [share, setShare] = useState('');
  const key = kstDateKey();

  const load = () => {
    const device = loadDeviceId();
    void fetch('/api/bun/pick/12', { headers: device ? { 'x-bun-device': device } : {} })
      .then((res) => res.json())
      .then((data: Board) => setBoard(data))
      .catch(() => setNotice(phaseMessage('bad_request')));
  };

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const choose = async (canonical: number) => {
    const next = [...picks, canonical];
    if (next.length < 3) {
      setPicks(next);
      setStep(next.length);
      return;
    }
    const device = loadDeviceId();
    const saved = profile;
    if (!device || !saved) {
      setNotice('이 브라우저에는 참여자 이름을 저장할 수 없어요.');
      return;
    }
    const res = await fetch('/api/bun/pick', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device, nickname: saved.nickname, region: saved.region, gameId: 12, value: { choices: next } }),
    });
    const data = (await res.json()) as { ok?: boolean; code?: string };
    if (!data.ok) {
      setNotice(phaseMessage(data.code ?? 'bad_request'));
      if (data.code === 'bad_nickname' || data.code === 'bad_region') setNeedEdit(true);
      return;
    }
    markDone(12);
    setPicks(next);
    setNotice('세 문항을 냈어요. 내일 0시에 비율이 나와요.');
    load();
  };

  if (!service) return null;
  const done = Boolean(board?.mine?.choices) || picks.length === 3;
  const question = majorityQuestions[step];
  const order = question ? majorityOrder(key, step) : [];
  const closedQs = board?.closed?.result?.questions ?? [];
  const closedMine = board?.closed?.mine?.choices ?? [];
  const hits = closedQs.map((item, index) => closedMine[index] === item.winner);
  const hitCount = hits.filter(Boolean).length;

  return (
    <>
      <GameFrame service={service} notice={notice} revision={0} profile={profile} needEdit={needEdit} onSave={save}>
        {done ? (
          <div className="room-stack">
            <h2 className="room-title">오늘 답을 냈어요</h2>
            <p className="hint">비율은 내일 0시에 나와요. 오늘은 다른 사람의 선택을 보여 주지 않아요.</p>
            {closedQs.length === 3 && closedMine.length === 3 ? (
              <div className="panel">
                <b>
                  지난 결과 {hitCount} / 3
                </b>
                <p>{hits.map((hit) => (hit ? '적중' : '빗나감')).join(' · ')}</p>
                <div className="form-actions">
                  <button className="btn sm" type="button" onClick={() => setShare(`다수결 맞히기\n${hits.map((hit) => (hit ? '적중' : '빗나감')).join(' ')}\n${hitCount}/3`)}>
                    결과 공유
                  </button>
                </div>
              </div>
            ) : (
              <p className="hint">아직 공개된 지난 결과가 없어요.</p>
            )}
          </div>
        ) : question ? (
          <div className="room-stack">
            <div className="row">
              {majorityQuestions.map((item, index) => (
                <i key={item.prompt} className={`count-pip${index < step ? ' on' : ''}${index === step ? ' now' : ''}`} />
              ))}
            </div>
            <h2 className="room-title">{question.prompt}</h2>
            <p className="hint">내가 좋아하는 것 말고, 남들이 가장 많이 고를 것 같은 것.</p>
            <div className="choice-grid">
              {order.map((canonical) => (
                <button key={canonical} type="button" onClick={() => void choose(canonical)}>
                  {question.kind === 'colors' ? (
                    <span className="color-row">
                      {question.options[canonical].map((color) => (
                        <i key={color} style={{ background: color }} />
                      ))}
                    </span>
                  ) : null}
                  {question.kind === 'shapes' ? <Shape kind={question.options[canonical][0]} /> : null}
                  {question.kind === 'patterns' ? <Pattern kind={question.options[canonical][0]} /> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </GameFrame>
      {share ? <ShareSheet slug="majority" title="다수결 맞히기" text={share} onClose={() => setShare('')} /> : null}
    </>
  );
}
