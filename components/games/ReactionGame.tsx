'use client';

import { useEffect, useRef, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ProfileForm } from '@/components/ProfileForm';
import { RegionPanel } from '@/components/RankBoard';
import { ShareSheet } from '@/components/ShareSheet';
import { Tickets, usePlay, type Finish } from '@/components/usePlay';
import { serviceById } from '@/content/services';
import { sharedJson } from '@/lib/client-fetch';
import { markDone } from '@/lib/done';
import { dateShort, rankLine } from '@/lib/share';

const service = serviceById(17)!;

export function ReactionGame() {
  const play = usePlay(17);
  const [phase, setPhase] = useState<'ready' | 'wait' | 'go' | 'done'>('ready');
  const [hint, setHint] = useState('초록이 되면 바로 누르세요');
  const [taps, setTaps] = useState<number[]>([]);
  const [result, setResult] = useState<Finish | null>(null);
  const [share, setShare] = useState(false);
  const [regions, setRegions] = useState<{ region: string; avg: number | string; count: number }[]>([]);
  const lit = useRef(0);
  const started = useRef(false);
  const waitTimer = useRef(0);
  const press = useRef<() => void>(() => undefined);

  useEffect(() => {
    void sharedJson(`board:17`, async () => {
      const res = await fetch('/api/bun/board/17');
      return (await res.json()) as { regions?: { region: string; avg: number | string; count: number }[] };
    })
      .then((data) => setRegions(data.regions ?? []))
      .catch(() => setRegions([]));
  }, [play.revision]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      const tag = (event.target as HTMLElement | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'A') return;
      if (tag === 'BUTTON' && !(event.target as HTMLElement).classList.contains('pad')) return;
      event.preventDefault();
      press.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const arm = (count: number) => {
    window.clearTimeout(waitTimer.current);
    setPhase('wait');
    setHint(`${count + 1}번째를 기다리세요`);
    const wait = 1200 + Math.random() * 2400;
    waitTimer.current = window.setTimeout(() => {
      lit.current = performance.now();
      setPhase('go');
      setHint('지금 누르세요');
    }, wait);
  };

  press.current = () => {
    if (phase === 'ready' || phase === 'done') {
      setTaps([]);
      setResult(null);
      started.current = false;
      arm(0);
      return;
    }
    if (phase === 'wait') {
      setHint('너무 일렀어요. 이번 것만 다시 해요.');
      arm(taps.length);
      return;
    }
    if (phase !== 'go') return;
    const ms = Math.round(performance.now() - lit.current);
    if (ms < 100) {
      setHint('100ms보다 빨라서 이번 번은 빼 둘게요.');
      arm(taps.length);
      return;
    }
    if (!started.current) {
      play.begin();
      started.current = true;
    }
    const next = [...taps, ms];
    setTaps(next);
    if (next.length < 3) {
      arm(next.length);
      return;
    }
    const score = Math.round(next.reduce((a, b) => a + b, 0) / 3);
    setPhase('done');
    void play.finish(score, { taps: next }).then((done) => {
      setResult(done);
      markDone(17);
    });
  };

  const shareText = result
    ? `시도 대항 반응속도 ${dateShort()}\n나 ${result.score}ms${result.kind === 'ranked' ? `\n${rankLine(result.rank, result.participants)}` : ''}`
    : '';

  return (
    <GameFrame
      service={service}
      notice={play.notice}
      rolled={play.rolled}
      playing={phase === 'wait' || phase === 'go'}
      revision={play.revision}
      profile={play.profile}
      needEdit={play.needEdit}
      onSave={play.save}
      side={
        <div>
          <h2>오늘 시도 평균</h2>
          <RegionPanel regions={regions} />
        </div>
      }
    >
      <div className="g-center">
        <Tickets left={play.attemptsLeft} total={play.tries} />
        {!play.profile ? (
          <p className="hint">준비하고 있어요.</p>
        ) : play.profile.region === '미정' ? (
          <>
            <p className="hint">시도를 고르기 전에는 공식 판을 시작하지 않아요.</p>
            <ProfileForm profile={play.profile} regionsOnly onSave={play.save} />
          </>
        ) : (
          <>
            <button className={`pad${phase === 'go' ? ' go' : ''}`} type="button" onClick={() => press.current()}>
              {phase === 'ready' ? '시작' : phase === 'done' ? '끝' : hint}
            </button>
            <p className="hint">{taps.length ? `${taps.join(' · ')} ms` : '한 판은 세 번이에요.'}</p>
            {result ? (
              <div className="panel" role="status">
                <b>{result.score}ms</b>
                <p className="rankline">{result.kind === 'ranked' ? rankLine(result.rank, result.participants) : result.message}</p>
                <div className="form-actions">
                  <button className="btn sm" type="button" onClick={() => press.current()}>
                    {(play.attemptsLeft ?? 0) > 0 ? `다시 도전 (${play.attemptsLeft}번 남음)` : '연습으로 다시'}
                  </button>
                  <button className="btn sm ghost" type="button" onClick={() => setShare(true)}>
                    결과 공유
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      {share && result ? <ShareSheet slug={service.slug} title={`${result.score}ms`} text={shareText} onClose={() => setShare(false)} /> : null}
    </GameFrame>
  );
}
