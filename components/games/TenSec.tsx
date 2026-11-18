'use client';

import { useEffect, useRef, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { Tickets, usePlay, type Finish } from '@/components/usePlay';
import { serviceById } from '@/content/services';
import { track } from '@/lib/analytics';
import { kstDateKey } from '@/lib/daily';
import { markDone } from '@/lib/done';
import { round3, targetSeconds } from '@/lib/games/10sec';
import { dateShort, rankLine } from '@/lib/share';

const service = serviceById(1)!;

export function TenSec() {
  const play = usePlay(1);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<'ready' | 'run' | 'done'>('ready');
  const [blur, setBlur] = useState(false);
  const [clock, setClock] = useState(0);
  const [result, setResult] = useState<Finish | null>(null);
  const [share, setShare] = useState(false);
  const target = useRef(0);
  const started = useRef(0);
  const frame = useRef(0);
  const press = useRef<() => void>(() => undefined);

  useEffect(() => {
    target.current = targetSeconds(kstDateKey());
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      const tag = (event.target as HTMLElement | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'A' || tag === 'BUTTON') return;
      event.preventDefault();
      press.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  press.current = () => {
    if (phase === 'done') return;
    if (phase === 'ready') {
      play.begin();
      started.current = performance.now();
      setPhase('run');
      const loop = () => {
        const sec = (performance.now() - started.current) / 1000;
        setClock(sec);
        if (sec >= 1.5) setBlur(true);
        frame.current = requestAnimationFrame(loop);
      };
      frame.current = requestAnimationFrame(loop);
      return;
    }
    cancelAnimationFrame(frame.current);
    const gameElapsed = round3((performance.now() - started.current) / 1000);
    const score = round3(Math.abs(gameElapsed - target.current));
    setPhase('done');
    void play.finish(score, { gameElapsed }).then((done) => {
      setResult(done);
      markDone(1);
    });
  };

  const again = () => {
    track('retry_click', { game: service.slug, attempts_left: play.attemptsLeft ?? 0 });
    cancelAnimationFrame(frame.current);
    setResult(null);
    setBlur(false);
    setClock(0);
    setPhase('ready');
    target.current = targetSeconds(kstDateKey());
  };

  const shareText = result
    ? `정확히 10초 ${dateShort()}\n목표 ${target.current.toFixed(2)}초, 오늘 최고 ±${(result.kind === 'ranked' ? result.best : result.score).toFixed(3)}초\n${squares(result.kind === 'ranked' ? result.best : result.score)}${result.kind === 'ranked' ? `\n${rankLine(result.rank, result.participants)}` : ''}`
    : '';

  return (
    <GameFrame service={service} notice={play.notice} rolled={play.rolled} playing={phase === 'run'} revision={play.revision} profile={play.profile} needEdit={play.needEdit} onSave={play.save}>
      <div className="g-center">
        <span className="lbl">오늘의 목표</span>
        <div className="bignum">
          {ready ? (
            <>
              {target.current.toFixed(2)}
              <small>초</small>
            </>
          ) : (
            '—'
          )}
        </div>
        <div className={`clk${blur && phase === 'run' ? ' blur' : ''}`}>{phase === 'run' && blur ? '?.???' : clock.toFixed(3)}</div>
        {phase !== 'done' ? (
          <button className="btn xl red" type="button" onClick={() => press.current()} disabled={!ready}>
            {phase === 'run' ? '멈춤' : '시작'}
          </button>
        ) : null}
        <Tickets left={play.attemptsLeft} total={play.tries} />
        <p className="hint">{phase === 'run' ? '지금! 숫자 없이 감으로 세는 중...' : '시작을 누르면 1.5초 뒤 숫자가 흐려집니다. 목표 시간이 됐다고 느낄 때 멈추세요.'}</p>
        {result ? <Result result={result} again={again} left={play.attemptsLeft} onShare={() => setShare(true)} /> : null}
      </div>
      {share && result ? <ShareSheet slug={service.slug} title={`${target.current.toFixed(2)}초`} text={shareText} onClose={() => setShare(false)} /> : null}
    </GameFrame>
  );
}

function squares(score: number): string {
  const filled = [0.03, 0.08, 0.15, 0.3, 0.6].filter((gate) => score < gate).length;
  return `${'🟩'.repeat(filled)}${'⬜'.repeat(5 - filled)}`;
}

function Result({ result, again, left, onShare }: { result: Finish; again: () => void; left: number | null; onShare: () => void }) {
  const perfect = result.score === 0 && result.kind === 'review';
  return (
    <div className="panel" role="status">
      <b>{perfect ? '±0.000초! 놀라운 기록이라 확인 후 순위에 들어가요' : `차이 ${result.score.toFixed(3)}초`}</b>
      <div className="squares" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <i key={index} className={index < [0.03, 0.08, 0.15, 0.3, 0.6].filter((gate) => result.score < gate).length ? 'on' : ''} />
        ))}
      </div>
      {result.kind === 'ranked' ? (
        <p className="rankline">
          {result.improved && result.prevRank ? `최고 기록을 고쳤어요. ${result.prevRank}위 → ${result.rank}위` : rankLine(result.rank, result.participants)}
        </p>
      ) : (
        <p className="hint">{perfect ? '' : result.message}</p>
      )}
      <div className="form-actions">
        <button className="btn sm" type="button" onClick={again}>
          {(left ?? 0) > 0 ? `다시 도전 (${left}번 남음)` : '연습으로 다시'}
        </button>
        <button className="btn sm ghost" type="button" onClick={onShare}>
          결과 공유
        </button>
      </div>
    </div>
  );
}
