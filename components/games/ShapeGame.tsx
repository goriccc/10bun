'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { Tickets, usePlay, type Finish } from '@/components/usePlay';
import { serviceById } from '@/content/services';
import { kstWeekday } from '@/lib/daily';
import { markDone } from '@/lib/done';
import { dayName, normalizeStroke, scoreTask, taskLabel, type ShapeTask } from '@/lib/games/shape';
import { dateShort, rankLine } from '@/lib/share';

const service = serviceById(3)!;

const TABS: { id: string; task: ShapeTask; weekday: number; name: string }[] = [
  { id: 'mon', task: 'circle', weekday: 1, name: '완벽한 원' },
  { id: 'tue', task: 'square', weekday: 2, name: '정사각형' },
  { id: 'wed', task: 'angle', weekday: 3, name: '정확한 직각' },
  { id: 'thu', task: 'triangle', weekday: 4, name: '정삼각형' },
  { id: 'fri', task: 'circle', weekday: 5, name: '반대 손으로 원' },
];

const hints = {
  short: '선을 조금 더 이어서 그려 주세요.',
  open: '도형이 이어지지 않았어요. 한 번에 닫아서 그려 주세요.',
  small: '너무 작아요. 화면을 더 크게 써서 그려 보세요.',
};

export function ShapeGame() {
  const play = usePlay(3);
  const weekday = kstWeekday();
  const official = TABS.find((tab) => tab.weekday === weekday) ?? null;
  const [tabId, setTabId] = useState(official?.id ?? 'mon');
  const tab = TABS.find((item) => item.id === tabId) ?? TABS[0];
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const points = useRef<{ x: number; y: number }[]>([]);
  const drawing = useRef(false);
  const [hint, setHint] = useState('');
  const [live, setLive] = useState('');
  const [result, setResult] = useState<Finish | null>(null);
  const [share, setShare] = useState(false);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setSize(node.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || size <= 0) return;
    const ratio = window.devicePixelRatio || 1;
    cv.width = Math.round(size * ratio);
    cv.height = Math.round(size * ratio);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(ctx, size, points.current, tab.task);
  }, [size, live, hint, tab.task]);

  const choose = (next: (typeof TABS)[number]) => {
    if (official && next.id !== official.id) {
      setHint(`${next.name}은 ${dayName(next.weekday)}요일에 열리는 과제예요.`);
      return;
    }
    points.current = [];
    setTabId(next.id);
    setHint(official ? '' : '주말에는 한 주 과제를 연습할 수 있어요. 순위에는 들어가지 않아요.');
    setLive('');
    setResult(null);
  };

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    points.current = [at(event)];
    setHint('');
    setLive('');
    setResult(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || size <= 0) return;
    points.current.push(at(event));
    const ctx = canvas.current?.getContext('2d');
    if (ctx) paint(ctx, size, points.current, tab.task);
    if (points.current.length > 12) {
      const judged = scoreTask(tab.task, normalizeStroke(points.current, size));
      if (judged.ok) setLive(`${judged.score.toFixed(1)}%`);
    }
  };

  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const norm = normalizeStroke(points.current, size);
    const judged = scoreTask(tab.task, norm);
    if (!judged.ok) {
      setHint(hints[judged.reason]);
      setLive('');
      return;
    }
    setLive(`${judged.score.toFixed(2)}점`);
    if (!official) {
      setResult({ kind: 'practice', message: '주말에는 연습이에요. 월요일에 오늘의 과제가 다시 열려요.', score: judged.score });
      markDone(3);
      return;
    }
    play.begin();
    void play.finish(judged.score, { task: tab.task, pts: norm }).then((done) => {
      setResult(done);
      markDone(3);
    });
  };

  const shareText = result
    ? `오늘의 도형 ${dateShort()} (${tab.name})\n오늘 ${result.score.toFixed(2)}점${result.kind === 'ranked' ? `\n${rankLine(result.rank, result.participants)}` : ''}`
    : '';

  return (
    <GameFrame service={service} notice={play.notice} rolled={play.rolled} playing={false} revision={play.revision} profile={play.profile} needEdit={play.needEdit} onSave={play.save} shareText={shareText || undefined}>
      <div className="g-center">
        <Tickets left={play.attemptsLeft} total={play.tries} />
        <div className="day-tabs" role="group" aria-label="요일 과제">
          {TABS.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === tab.id} onClick={() => choose(item)}>
              {dayName(item.weekday)}
              <small>{item.name}</small>
            </button>
          ))}
        </div>
        <p className="hint">
          마우스나 손가락으로 그려요. 오늘 과제는 {official ? taskLabel(weekday) : `${tab.name} 연습`}이에요.
          {tab.weekday === 5 ? ' 평소와 반대 손으로 그려 보세요.' : ''}
        </p>
        <div className="box" ref={box}>
          <canvas ref={canvas} className="draw" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="도형 그리기" />
          <b className="live-score">{live}</b>
        </div>
        {hint ? <p className="hint warn">{hint}</p> : null}
        {result ? (
          <div className="panel" role="status">
            <b>
              {result.score.toFixed(2)}점. {praise(tab.task, result.score)}
            </b>
            <p className="rankline">{result.kind === 'ranked' ? rankLine(result.rank, result.participants) : result.message}</p>
            {official ? (
              <p className="hint">{(play.attemptsLeft ?? 0) > 0 ? `공식 도전 ${play.attemptsLeft}번 남았어요. 다시 그리면 도전이에요.` : '오늘 공식 도전은 끝났어요. 계속 그리면 연습이에요.'}</p>
            ) : null}
            <div className="form-actions">
              <button className="btn sm ghost" type="button" onClick={() => setShare(true)}>
                결과 공유
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {share && result ? <ShareSheet slug={service.slug} title={`${result.score.toFixed(2)}점`} text={shareText} onClose={() => setShare(false)} /> : null}
    </GameFrame>
  );
}

function praise(task: ShapeTask, score: number): string {
  if (task === 'circle' && score > 95) return '컴퍼스를 쓰신 건가요?';
  if (score > 90) return '손이 꽤 안정적이에요.';
  if (score > 75) return '형태가 보여요.';
  return '한 번 더 천천히 그려 보세요.';
}

function at(event: PointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function paint(ctx: CanvasRenderingContext2D, size: number, pts: { x: number; y: number }[], task: ShapeTask) {
  ctx.clearRect(0, 0, size, size);
  if (task === 'circle') {
    const c = size / 2;
    ctx.fillStyle = '#231D4B';
    ctx.beginPath();
    ctx.arc(c, c, 5, 0, Math.PI * 2);
    ctx.fill();
    if (pts.length < 2) return;
    const ds = pts.map((point) => Math.hypot(point.x - c, point.y - c));
    const mean = ds.reduce((sum, value) => sum + value, 0) / ds.length;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i += 1) {
      const wobble = Math.abs(ds[i] - mean) / (mean || 1);
      ctx.strokeStyle = wobble < 0.03 ? '#2DCEA2' : wobble < 0.08 ? '#FFD13D' : '#FF5E5B';
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    return;
  }
  if (pts.length < 2) return;
  ctx.strokeStyle = '#231D4B';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
  ctx.stroke();
}
