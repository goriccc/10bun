'use client';

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { serviceById } from '@/content/services';
import { kstDateKey } from '@/lib/daily';
import { markDone } from '@/lib/done';
import { drawHref, encodeStrokes, readDrawHash, todayWord } from '@/lib/games/draw';
import type { Pt } from '@/lib/games/shape';

const service = serviceById(10)!;

export function DrawGame() {
  const [mode, setMode] = useState<'boot' | 'draw' | 'view'>('boot');
  const [timing, setTiming] = useState(false);
  const [wordOn, setWordOn] = useState(false);
  const [left, setLeft] = useState(20);
  const [done, setDone] = useState(false);
  const [href, setHref] = useState('');
  const [share, setShare] = useState(false);
  const [guess, setGuess] = useState('');
  const [verdict, setVerdict] = useState('');
  const [correct, setCorrect] = useState(false);
  const [viewKey, setViewKey] = useState('');
  const strokes = useRef<Pt[][]>([]);
  const current = useRef<Pt[] | null>(null);
  const started = useRef<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const seen = useRef<Pt[][]>([]);

  useEffect(() => {
    const packed = readDrawHash(window.location.hash);
    if (packed) {
      seen.current = packed.strokes;
      setViewKey(packed.key);
      setMode('view');
      return;
    }
    setMode('draw');
  }, []);

  useEffect(() => {
    if (mode !== 'draw') return;
    const node = box.current;
    const cv = canvas.current;
    if (!node || !cv) return;
    const paint = () => {
      const width = node.getBoundingClientRect().width;
      const ratio = window.devicePixelRatio || 1;
      cv.width = Math.round(width * ratio);
      cv.height = Math.round(width * ratio);
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawInk(ctx, width, strokes.current);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode, done]);

  useEffect(() => {
    if (mode !== 'view') return;
    const cv = view.current;
    if (!cv) return;
    const width = cv.getBoundingClientRect().width || 320;
    const ratio = window.devicePixelRatio || 1;
    cv.width = Math.round(width * ratio);
    cv.height = Math.round(width * ratio);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const total = seen.current.reduce((sum, stroke) => sum + stroke.length, 0);
    let shown = 0;
    let frame = 0;
    const step = () => {
      shown += Math.max(1, total / 90);
      drawInk(ctx, width, seen.current, shown);
      if (shown < total) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [mode, viewKey]);

  const finish = () => {
    if (done) return;
    if (strokes.current.length === 0) {
      setVerdict('먼저 그림을 그려 주세요.');
      return;
    }
    setDone(true);
    const key = kstDateKey();
    const code = encodeStrokes(strokes.current);
    setHref(drawHref(key, code, 'copy'));
    markDone(10);
  };

  useEffect(() => {
    if (!timing || done) return;
    const timer = window.setInterval(() => {
      const remain = Math.max(0, 20 - Math.floor((Date.now() - (started.current ?? Date.now())) / 1000));
      setLeft(remain);
      if (remain === 0) finish();
    }, 200);
    return () => window.clearInterval(timer);
  }, [timing, done]);

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (done) return;
    const point = at(event);
    current.current = [point];
    strokes.current = [...strokes.current, current.current];
    if (started.current == null) {
      started.current = Date.now();
      setTiming(true);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    redraw();
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!current.current || done) return;
    current.current.push(at(event));
    redraw();
  };

  const up = () => {
    current.current = null;
  };

  const redraw = () => {
    const cv = canvas.current;
    const node = box.current;
    if (!cv || !node) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    drawInk(ctx, node.getBoundingClientRect().width, strokes.current);
  };

  const clear = () => {
    if (done) return;
    strokes.current = [];
    current.current = null;
    setVerdict('');
    redraw();
  };

  const onGuess = (event: FormEvent) => {
    event.preventDefault();
    const answer = todayWord(viewKey);
    if (guess.trim() === answer) {
      setCorrect(true);
      setVerdict('정답이에요. 이제 내 그림으로 답장할 수 있어요.');
      markDone(10);
      return;
    }
    setVerdict(`아직 아니에요. 힌트는 ${answer.length}글자예요.`);
  };

  const word = todayWord();

  return (
    <GameFrame service={service} revision={0} profile={null} playing={!correct} onSave={async () => ({ ok: true })}>
      {mode === 'boot' ? <p className="hint">그림을 준비하고 있어요.</p> : null}
      {mode === 'draw' ? (
        <div className="g-center">
          <div className="row c">
            <span className="lbl">오늘의 제시어</span>
            {wordOn ? <b className="plain">{word}</b> : <button className="btn pink sm" type="button" onClick={() => setWordOn(true)}>제시어 보기</button>}
          </div>
          <div className="box ink" ref={box}>
            <canvas ref={canvas} className="draw" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="그림판" />
            <b className="draw-time">{left}</b>
          </div>
          <div className="row c">
            <button className="linkbtn" type="button" onClick={clear} disabled={done}>
              지우고 다시
            </button>
            <button className="btn sm" type="button" onClick={finish}>
              다 그렸어요
            </button>
          </div>
          <p className="hint">첫 선을 그으면 20초가 시작돼요. 그림은 링크 안에만 담기고 서버로 보내지 않아요.</p>
          {verdict ? <p className="hint warn">{verdict}</p> : null}
          {done && href ? (
            <div className="panel" role="status">
              <b>보낼 링크가 준비됐어요.</b>
              <p className="hint">친구가 링크를 열면 그림이 다시 그려져요. 정답은 링크에 적혀 있지 않아요.</p>
              <div className="form-actions">
                <button className="btn sm" type="button" onClick={() => setShare(true)}>
                  링크 보내기
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {mode === 'view' ? (
        <div className="g-center">
          <p className="hint">친구가 20초 동안 그린 그림이에요. 광고는 정답을 맞힌 뒤에만 나와요.</p>
          <canvas ref={view} className="draw view" aria-label="받은 그림" />
          <form className="row c" onSubmit={onGuess}>
            <input className="inp" value={guess} onChange={(event) => setGuess(event.target.value)} aria-label="정답" placeholder="정답 입력" />
            <button className="btn pink sm" type="submit">
              맞히기
            </button>
          </form>
          {verdict ? <p className="hint">{verdict}</p> : null}
          {correct ? (
            <button
              className="btn sm"
              type="button"
              onClick={() => {
                window.location.hash = '';
                setMode('draw');
                setCorrect(false);
                setVerdict('');
              }}
            >
              내 그림으로 답장
            </button>
          ) : null}
        </div>
      ) : null}
      {share && href ? (
        <ShareSheet
          slug={service.slug}
          title="그림 맞히기"
          text="오늘의 그림 맞히기\n20초 안에 그린 그림이에요. 뭔지 맞혀 보세요."
          linkFor={(medium) => (medium === 'native' ? href.replace('utm_medium=copy', 'utm_medium=native') : href)}
          onClose={() => setShare(false)}
        />
      ) : null}
    </GameFrame>
  );
}

function at(event: PointerEvent<HTMLCanvasElement>): Pt {
  const rect = event.currentTarget.getBoundingClientRect();
  return [Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))];
}

function drawInk(ctx: CanvasRenderingContext2D, width: number, strokes: Pt[][], limit = Infinity) {
  ctx.clearRect(0, 0, width, width);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#231D4B';
  ctx.lineWidth = Math.max(4, width / 70);
  let seen = 0;
  for (const stroke of strokes) {
    ctx.beginPath();
    stroke.forEach((point, index) => {
      if (seen > limit) return;
      seen += 1;
      if (index === 0) ctx.moveTo(point[0] * width, point[1] * width);
      else ctx.lineTo(point[0] * width, point[1] * width);
    });
    ctx.stroke();
  }
}
