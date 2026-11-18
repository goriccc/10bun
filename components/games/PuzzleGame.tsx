'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { Tickets, usePlay, type Finish } from '@/components/usePlay';
import { serviceById } from '@/content/services';
import { kstDateKey } from '@/lib/daily';
import { markDone } from '@/lib/done';
import { makePuzzle, sizeFor, type Puzzle } from '@/lib/games/puzzle';
import { dateShort, rankLine } from '@/lib/share';
import { puzzleResultShareText } from '@/lib/share-text';

const service = serviceById(15)!;

type Phase = 'idle' | 'boot' | 'preview' | 'shuffle' | 'play' | 'done';

function tileStyle(n: number, value: number, image: string | null): CSSProperties {
  if (!value) return {};
  const goal = value - 1;
  const gr = Math.floor(goal / n);
  const gc = goal % n;
  if (!image) return { background: '#fff', boxShadow: 'inset 0 0 0 1px rgba(35,29,75,.08)' };
  return {
    backgroundImage: `url(${image})`,
    backgroundSize: `${n * 100}% ${n * 100}%`,
    backgroundPosition: `${(gc / Math.max(1, n - 1)) * 100}% ${(gr / Math.max(1, n - 1)) * 100}%`,
  };
}

function slideBlank(tiles: number[], n: number, from: number, to: number): { tiles: number[]; moves: string } | null {
  const br = Math.floor(to / n);
  const bc = to % n;
  const fr = Math.floor(from / n);
  const fc = from % n;
  if ((br !== fr && bc !== fc) || tiles[to] !== 0) return null;
  const next = tiles.slice();
  const parts: string[] = [];
  if (br === fr) {
    const step = fc < bc ? 1 : -1;
    for (let c = bc - step; step > 0 ? c >= fc : c <= fc; c -= step) {
      const a = br * n + c + step;
      const b = br * n + c;
      next[a] = next[b]!;
      next[b] = 0;
      parts.push(step > 0 ? 'L' : 'R');
    }
  } else {
    const step = fr < br ? 1 : -1;
    for (let r = br - step; step > 0 ? r >= fr : r <= fr; r -= step) {
      const a = (r + step) * n + bc;
      const b = r * n + bc;
      next[a] = next[b]!;
      next[b] = 0;
      parts.push(step > 0 ? 'U' : 'D');
    }
  }
  return { tiles: next, moves: parts.join('') };
}

function formatClock(ms: number): string {
  const sec = Math.max(0, ms) / 1000;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2);
  return m > 0 ? `${m}:${s.padStart(5, '0')}` : s;
}

export function PuzzleGame() {
  const play = usePlay(15);
  const key = kstDateKey();
  const officialSize = sizeFor(key);
  const [phase, setPhase] = useState<Phase>('idle');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [tiles, setTiles] = useState<number[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [practiceSize, setPracticeSize] = useState(3);
  const [countdown, setCountdown] = useState(3);
  const [previewReady, setPreviewReady] = useState(false);
  const [moves, setMoves] = useState('');
  const [clockMs, setClockMs] = useState(0);
  const [result, setResult] = useState<Finish | null>(null);
  const [share, setShare] = useState(false);
  const [official, setOfficial] = useState(true);
  const [peek, setPeek] = useState(false);
  const startedAt = useRef(0);
  const tilesRef = useRef<number[]>([]);
  const movesRef = useRef('');
  const puzzleRef = useRef<Puzzle | null>(null);
  const reduced = useRef(false);
  const peekRef = useRef(false);
  const busyRef = useRef(false);
  const [introKey, setIntroKey] = useState(0);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!image) return;
    const probe = new window.Image();
    probe.onerror = () => setImage(null);
    probe.src = image;
  }, [image]);

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);
  useEffect(() => {
    movesRef.current = moves;
  }, [moves]);
  useEffect(() => {
    puzzleRef.current = puzzle;
  }, [puzzle]);
  useEffect(() => {
    peekRef.current = peek;
  }, [peek]);

  const enterPlay = (board: Puzzle) => {
    setTiles(board.tiles.slice());
    startedAt.current = performance.now();
    setClockMs(0);
    setPhase('play');
  };

  const runIntro = (board: Puzzle) => {
    setPuzzle(board);
    setTiles(Array.from({ length: board.n * board.n }, (_, i) => (i + 1) % (board.n * board.n)));
    setCountdown(3);
    setPreviewReady(false);
    setIntroKey((value) => value + 1);
    setPhase('preview');
  };

  const skipPreview = () => {
    if (!puzzle || !previewReady || phase !== 'preview') return;
    setPhase('shuffle');
  };

  useEffect(() => {
    if (phase !== 'preview' || introKey === 0) return;
    const previewMs = reduced.current ? 300 : 3000;
    const t0 = performance.now();
    setCountdown(3);
    setPreviewReady(false);
    const tick = window.setInterval(() => {
      setCountdown(Math.max(1, Math.ceil((previewMs - (performance.now() - t0)) / 1000)));
    }, 200);
    const ready = window.setTimeout(() => setPreviewReady(true), reduced.current ? 0 : 1000);
    const done = window.setTimeout(() => setPhase('shuffle'), previewMs);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(ready);
      window.clearTimeout(done);
    };
  }, [phase, introKey]);

  useEffect(() => {
    if (phase !== 'shuffle') return;
    const board = puzzleRef.current;
    if (!board) return;
    const wait = reduced.current ? 0 : 500;
    const timer = window.setTimeout(() => enterPlay(board), wait);
    return () => window.clearTimeout(timer);
  }, [phase, introKey]);

  const beginOfficial = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('boot');
    setResult(null);
    setMoves('');
    movesRef.current = '';
    setClockMs(0);
    setPeek(false);
    setOfficial(true);
    try {
      const started = await play.begin();
      const payload = started as { ok?: boolean; puzzle?: { size?: number; image?: string | null } };
      const n = payload.puzzle?.size && payload.puzzle.size >= 3 ? payload.puzzle.size : officialSize;
      // 연습 폴백이어도 오늘 그림은 서버 프록시로 불러온다 (Storage 직접 URL 의존 X)
      const img = payload.puzzle?.image || `/api/bun/puzzle/img?d=${encodeURIComponent(key)}`;
      const board = makePuzzle(key, n);
      setImage(img);
      runIntro(board);
    } catch {
      busyRef.current = false;
      setPhase('idle');
    }
  };

  const startPractice = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setResult(null);
    setMoves('');
    movesRef.current = '';
    setClockMs(0);
    setPeek(false);
    setOfficial(false);
    setImage(null);
    void play.begin();
    runIntro(makePuzzle(key, practiceSize, Math.floor(Math.random() * 1e9) + 1));
  };

  const applyMove = (from: number) => {
    if (phase !== 'play' || peekRef.current) return;
    const board = puzzleRef.current;
    if (!board) return;
    const blank = tilesRef.current.indexOf(0);
    const slid = slideBlank(tilesRef.current, board.n, from, blank);
    if (!slid) return;
    const nextMoves = movesRef.current + slid.moves;
    tilesRef.current = slid.tiles;
    movesRef.current = nextMoves;
    setTiles(slid.tiles);
    setMoves(nextMoves);
    const solved = slid.tiles.every((v, i) => v === (i + 1) % (board.n * board.n));
    if (!solved) return;
    const solveMs = Math.round(performance.now() - startedAt.current);
    setClockMs(solveMs);
    setPhase('done');
    const score = Math.round(solveMs / 10) / 100;
    void play.finish(score, { n: board.n, moves: nextMoves, solveMs }).then((done) => {
      setResult(done);
      markDone(15);
    });
  };

  useEffect(() => {
    if (phase !== 'play') return;
    const id = window.setInterval(() => setClockMs(performance.now() - startedAt.current), 50);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (event: KeyboardEvent) => {
      const board = puzzleRef.current;
      if (!board) return;
      const blank = tilesRef.current.indexOf(0);
      const n = board.n;
      const r = Math.floor(blank / n);
      const c = blank % n;
      let from = -1;
      if (event.key === 'ArrowRight' && c > 0) from = blank - 1;
      else if (event.key === 'ArrowLeft' && c < n - 1) from = blank + 1;
      else if (event.key === 'ArrowDown' && r > 0) from = blank - n;
      else if (event.key === 'ArrowUp' && r < n - 1) from = blank + n;
      else return;
      event.preventDefault();
      applyMove(from);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const shareText = result
    ? `${puzzleResultShareText(puzzle?.n ?? officialSize, result.score, moves.length)}${result.kind === 'ranked' ? `\n${rankLine(result.rank, result.participants)}` : ''}`
    : '';

  const again = () => {
    busyRef.current = false;
    setPhase('idle');
    setResult(null);
    setPuzzle(null);
    setTiles([]);
    setMoves('');
    setClockMs(0);
    setPeek(false);
    setCountdown(3);
    setPreviewReady(false);
  };

  return (
    <GameFrame
      service={service}
      notice={play.notice}
      rolled={play.rolled}
      playing={phase === 'play'}
      revision={play.revision}
      profile={play.profile}
      needEdit={play.needEdit}
      onSave={play.save}
      shareText={shareText || undefined}
    >
      <div className="g-center">
        {phase === 'idle' || phase === 'boot' ? (
          <>
            <span className="lbl">오늘 판</span>
            <div className="bignum blue">
              {officialSize}×{officialSize}
            </div>
            <p className="hint">공식 도전은 하루 한 번이에요. 맞추는 데 걸린 시간으로 전국 순위를 매겨요.</p>
            {phase === 'boot' ? (
              <p className="hint">그림을 준비하고 있어요.</p>
            ) : (
              <button className="btn xl" type="button" onClick={() => void beginOfficial()}>
                시작
              </button>
            )}
            <Tickets left={play.attemptsLeft} total={play.tries} />
            <div className="puzzle-practice">
              <label className="puzzle-practice-size">
                연습 크기
                <select value={practiceSize} onChange={(e) => setPracticeSize(Number(e.target.value))} disabled={phase === 'boot'}>
                  <option value={3}>3×3</option>
                  <option value={4}>4×4</option>
                  <option value={5}>5×5</option>
                </select>
              </label>
              <button className="btn sm ghost" type="button" onClick={startPractice} disabled={phase === 'boot'}>
                연습하기
              </button>
            </div>
          </>
        ) : null}

        {phase === 'preview' && puzzle ? (
          <>
            <button
              className="puzzle-preview"
              type="button"
              style={image ? { backgroundImage: `url(${image})` } : undefined}
              onClick={skipPreview}
            >
              {countdown}
            </button>
            {!official ? (
              <button className="btn sm ghost" type="button" onClick={again}>
                돌아가기
              </button>
            ) : null}
          </>
        ) : null}

        {(phase === 'shuffle' || phase === 'play' || phase === 'done') && puzzle ? (
          <>
            <div className="puzzle-meta" aria-live="polite">
              <span>{formatClock(clockMs)}</span>
              <span>{moves.length}번 이동</span>
            </div>
            {peek && image && phase === 'play' ? (
              <button
                className="puzzle-preview"
                type="button"
                style={{ backgroundImage: `url(${image})` }}
                onClick={() => setPeek(false)}
                aria-label="원본 이미지. 누르면 퍼즐로 돌아가요"
              />
            ) : phase === 'done' && image ? (
              <div className="puzzle-reveal" style={{ backgroundImage: `url(${image})` }} aria-label="완성된 그림" />
            ) : (
              <div className={`puzzle-board${phase === 'done' ? ' solved' : ''}`} style={{ gridTemplateColumns: `repeat(${puzzle.n}, 1fr)` }}>
                {tiles.map((value, index) => (
                  <button
                    key={`${puzzle.n}-${index}`}
                    type="button"
                    className={`puzzle-tile${value === 0 ? ' blank' : ''}`}
                    style={tileStyle(puzzle.n, value, image)}
                    disabled={phase !== 'play' || value === 0}
                    onClick={() => applyMove(index)}
                    aria-label={value ? `${value}번 조각` : '빈칸'}
                  >
                    {!image && value ? value : null}
                  </button>
                ))}
              </div>
            )}
            {phase === 'play' && image ? (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <button className="btn sm ghost" type="button" onClick={() => setPeek((v) => !v)}>
                  {peek ? '퍼즐로 돌아가기' : '원본 이미지 보기'}
                </button>
              </div>
            ) : null}
            {!official && phase !== 'done' ? (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <button className="btn sm ghost" type="button" onClick={again}>
                  돌아가기
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {result ? (
          <div className="panel" role="status">
            <b>
              {formatClock(result.score * 1000)} · {moves.length}번 이동
            </b>
            {result.kind === 'ranked' ? (
              <p>
                {rankLine(result.rank, result.participants)}
                {result.improved ? ' · 오늘 최고 갱신' : ''}
              </p>
            ) : (
              <p>{result.message}</p>
            )}
            <div className="row c">
              <button className="btn sm" type="button" onClick={() => setShare(true)}>
                결과 공유
              </button>
              <button className="btn sm ghost" type="button" onClick={again}>
                다시
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {share && result ? (
        <ShareSheet
          slug={service.slug}
          title={`${dateShort()} ${puzzle?.n ?? officialSize}×${puzzle?.n ?? officialSize}`}
          text={shareText}
          kind="result"
          onClose={() => setShare(false)}
        />
      ) : null}
    </GameFrame>
  );
}
