'use client';

import { useEffect, useRef, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { Tickets, usePlay, type Finish } from '@/components/usePlay';
import { serviceById } from '@/content/services';
import { kstDateKey } from '@/lib/daily';
import { markDone } from '@/lib/done';
import { generatePuzzle, replay, type Puzzle, type Step } from '@/lib/games/number';
import { dateShort, rankLine } from '@/lib/share';

const service = serviceById(6)!;
const signs = [
  ['+', '+'],
  ['-', '-'],
  ['×', '*'],
  ['÷', '/'],
] as const;

export function NumberGame() {
  const play = usePlay(6);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [slots, setSlots] = useState<(number | null)[]>([]);
  const [ops, setOps] = useState<Step[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [op, setOp] = useState<Step[1] | null>(null);
  const [hint, setHint] = useState('');
  const [gave, setGave] = useState(false);
  const [ask, setAsk] = useState(false);
  const [result, setResult] = useState<Finish | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [share, setShare] = useState(false);
  const [moves, setMoves] = useState(0);
  const opened = useRef(0);
  const clock = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setPuzzle(generatePuzzle(kstDateKey())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const start = () => {
    if (!puzzle) return;
    play.begin();
    opened.current = performance.now();
    window.clearInterval(clock.current);
    clock.current = window.setInterval(() => setSeconds(Math.round((performance.now() - opened.current) / 1000)), 200);
    setSlots(puzzle.nums.slice());
    setOps([]);
    setSel(null);
    setOp(null);
    setGave(false);
    setResult(null);
    setMoves(0);
    setSeconds(0);
    setPhase('play');
  };

  const apply = (index: number) => {
    if (!puzzle || phase !== 'play') return;
    if (sel == null || op == null) {
      if (slots[index] == null) return;
      setSel(sel === index ? null : index);
      return;
    }
    if (index === sel) {
      setSel(null);
      setOp(null);
      return;
    }
    const nextOps: Step[] = [...ops, [sel, op, index]];
    const played = replay(puzzle.nums, nextOps);
    if (!played || played.result == null) {
      setHint(op === '/' ? '나누어떨어지지 않아요' : '결과가 1 이상인 계산만 돼요');
      return;
    }
    setHint('');
    setOps(nextOps);
    setSlots(played.slots);
    setSel(index);
    setOp(null);
    setMoves(nextOps.length);
    if (played.result === puzzle.target) {
      const solveSeconds = Math.round((performance.now() - opened.current) / 1000);
      window.clearInterval(clock.current);
      setPhase('done');
      if (gave) {
        setResult({ kind: 'practice', message: '풀이를 본 판이라 순위에는 들어가지 않아요.', score: solveSeconds });
        return;
      }
      void play.finish(solveSeconds, { solveSeconds, ops: nextOps }).then((done) => {
        setResult(done);
        markDone(6);
      });
    }
  };

  const undo = () => {
    if (!puzzle || ops.length === 0) return;
    const next = ops.slice(0, -1);
    setOps(next);
    setSlots(replay(puzzle.nums, next)?.slots ?? puzzle.nums.slice());
    setSel(null);
    setOp(null);
    setMoves(next.length);
  };

  const stars = moves <= 3 ? 5 : moves <= 4 ? 4 : 3;
  const shareText =
    puzzle && result
      ? `숫자 만들기 ${dateShort()}\n목표 ${puzzle.target}, ${Math.floor(result.score / 60)}분 ${result.score % 60}초, ${moves}단계\n${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)}${result.kind === 'ranked' ? `\n${rankLine(result.rank, result.participants)}` : ''}`
      : '';

  return (
    <GameFrame service={service} notice={play.notice} rolled={play.rolled} playing={phase === 'play'} revision={play.revision} profile={play.profile} needEdit={play.needEdit} onSave={play.save}>
      <div className="g-center">
        <Tickets left={play.attemptsLeft} total={play.tries} />
        {phase === 'ready' ? (
          <>
            <h2 className="plain">숫자 여섯 개로 목표를 만들어요</h2>
            <p className="hint">시작을 눌러야 문제가 보여요.</p>
            <button className="btn xl" type="button" onClick={start} disabled={!puzzle}>
              시작
            </button>
          </>
        ) : (
          <>
            <span className="lbl">목표 숫자 · {seconds}초</span>
            <div className="bignum blue">{puzzle?.target}</div>
            <div className="tiles">
              {slots.map((value, index) =>
                value == null ? (
                  <span key={index} className="tile empty" />
                ) : (
                  <button key={index} className={`btn tile${sel === index ? ' blue' : ' ghost'}`} type="button" onClick={() => apply(index)}>
                    {value}
                  </button>
                ),
              )}
            </div>
            <div className="row c">
              {signs.map(([label, value]) => (
                <button key={value} className={`btn sm${op === value ? ' yellow' : ' ghost'}`} type="button" onClick={() => (sel == null ? setHint('먼저 숫자를 고르세요') : setOp(value))}>
                  {label}
                </button>
              ))}
            </div>
            <div className="row c">
              <button className="linkbtn" type="button" onClick={undo}>
                한 단계 되돌리기
              </button>
              <button className="linkbtn" type="button" onClick={() => setAsk(true)}>
                풀이 보기
              </button>
            </div>
            {hint ? <p className="hint">{hint}</p> : <p className="hint">숫자, 연산, 숫자 순서로 눌러요.</p>}
          </>
        )}
        {gave && puzzle ? (
          <div className="panel">
            <b>풀이 예시</b>
            <p>
              {puzzle.sample} = {puzzle.target}
            </p>
            <p className="hint">다른 풀이도 정답이에요. 풀이를 본 뒤에는 순위에 들어가지 않아요.</p>
          </div>
        ) : null}
        {result ? (
          <div className="panel" role="status">
            <b>
              {puzzle?.target} 완성! {Math.floor(result.score / 60)}분 {result.score % 60}초, {moves}단계
            </b>
            <p className="rankline">{result.kind === 'ranked' ? rankLine(result.rank, result.participants) : result.message}</p>
            <div className="form-actions">
              <button className="btn sm ghost" type="button" onClick={() => setShare(true)}>
                결과 공유
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {ask ? (
        <div className="ticket" role="presentation">
          <article role="dialog" aria-labelledby="solve-title">
            <h3 id="solve-title">풀이를 보면 오늘 순위 도전은 끝나요.</h3>
            <div className="row c">
              <button
                className="btn sm"
                type="button"
                onClick={() => {
                  setGave(true);
                  setAsk(false);
                }}
              >
                풀이 보기
              </button>
              <button className="btn sm ghost" type="button" onClick={() => setAsk(false)}>
                닫기
              </button>
            </div>
          </article>
        </div>
      ) : null}
      {share && result ? <ShareSheet slug={service.slug} title={`${Math.floor(result.score / 60)}분 ${result.score % 60}초`} text={shareText} onClose={() => setShare(false)} /> : null}
    </GameFrame>
  );
}
