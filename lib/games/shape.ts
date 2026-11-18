import { dateFromKey, kstWeekday } from '../daily';
import { round2 } from './color';

export type Pt = [number, number];

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function normalizeStroke(points: { x: number; y: number }[], size: number): Pt[] {
  if (size <= 0 || points.length === 0) return [];
  const step = Math.max(1, Math.ceil(points.length / 200));
  const out: Pt[] = [];
  for (let i = 0; i < points.length && out.length < 200; i += step) {
    out.push([round3(points[i].x / size), round3(points[i].y / size)]);
  }
  const last = points[points.length - 1];
  const end: Pt = [round3(last.x / size), round3(last.y / size)];
  if (out.length === 0 || out[out.length - 1][0] !== end[0] || out[out.length - 1][1] !== end[1]) {
    if (out.length === 200) out[199] = end;
    else out.push(end);
  }
  return out;
}

export function circleScore(pts: Pt[]): { ok: true; score: number } | { ok: false; reason: 'short' | 'open' | 'small' } {
  if (pts.length < 30 || pts.length > 200) return { ok: false, reason: 'short' };
  const cx = 0.5;
  const cy = 0.5;
  const ds = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
  const m = ds.reduce((a, b) => a + b, 0) / ds.length;
  const sd = Math.sqrt(ds.reduce((a, b) => a + (b - m) ** 2, 0) / ds.length);
  let ang = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const a1 = Math.atan2(pts[i - 1][1] - cy, pts[i - 1][0] - cx);
    const a2 = Math.atan2(pts[i][1] - cy, pts[i][0] - cx);
    let d = a2 - a1;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    ang += d;
  }
  const cov = (Math.abs(ang) * 180) / Math.PI;
  if (cov < 300) return { ok: false, reason: 'open' };
  if (m < 0.12) return { ok: false, reason: 'small' };
  const score = Math.max(0, Math.min(100, round2(100 - (sd / m) * 100 * 3.1)));
  return { ok: true, score };
}

export type ShapeTask = 'circle' | 'square' | 'angle' | 'triangle';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function taskForWeekday(weekday: number): ShapeTask | null {
  if (weekday === 1 || weekday === 5) return 'circle';
  if (weekday === 2) return 'square';
  if (weekday === 3) return 'angle';
  if (weekday === 4) return 'triangle';
  return null;
}

export function taskLabel(weekday: number): string {
  if (weekday === 1) return '완벽한 원';
  if (weekday === 2) return '정사각형';
  if (weekday === 3) return '정확한 직각';
  if (weekday === 4) return '정삼각형';
  if (weekday === 5) return '반대 손으로 원';
  return '주말 연습';
}

export function dayName(weekday: number): string {
  return DAYS[weekday] ?? '';
}

function gap(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function resample(pts: Pt[], count: number): Pt[] {
  if (pts.length === 0) return [];
  const mark = [0];
  for (let i = 1; i < pts.length; i += 1) mark.push(mark[i - 1] + gap(pts[i - 1], pts[i]));
  const total = mark[mark.length - 1];
  if (total === 0) return Array.from({ length: count }, () => pts[0]);
  const out: Pt[] = [];
  for (let k = 0; k < count; k += 1) {
    const target = (total * k) / (count - 1);
    let i = 1;
    while (i < mark.length && mark[i] < target) i += 1;
    if (i >= mark.length) {
      out.push(pts[pts.length - 1]);
      continue;
    }
    const span = mark[i] - mark[i - 1] || 1;
    const t = (target - mark[i - 1]) / span;
    out.push([round3(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t), round3(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t)]);
  }
  return out;
}

function turnDeg(pts: Pt[], index: number): number {
  const a = pts[index - 1];
  const b = pts[index];
  const c = pts[index + 1];
  const v1x = b[0] - a[0];
  const v1y = b[1] - a[1];
  const v2x = c[0] - b[0];
  const v2y = c[1] - b[1];
  const ang = Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
  return (Math.abs(ang) * 180) / Math.PI;
}

function loopTurns(pts: Pt[]): number[] {
  const count = pts.length;
  return pts.map((_, index) => {
    const prev = pts[(index - 1 + count) % count];
    const curr = pts[index];
    const next = pts[(index + 1) % count];
    const v1x = curr[0] - prev[0];
    const v1y = curr[1] - prev[1];
    const v2x = next[0] - curr[0];
    const v2y = next[1] - curr[1];
    const ang = Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
    return (Math.abs(ang) * 180) / Math.PI;
  });
}

function pickPeaks(turns: number[], count: number, minGap: number): number[] {
  const chosen: number[] = [];
  for (let n = 0; n < count; n += 1) {
    let best = -1;
    let bestTurn = 0;
    for (let i = 0; i < turns.length; i += 1) {
      if (chosen.some((item) => Math.min(Math.abs(item - i), turns.length - Math.abs(item - i)) < minGap)) continue;
      if (turns[i] > bestTurn) {
        bestTurn = turns[i];
        best = i;
      }
    }
    if (best < 0 || bestTurn < 28) break;
    chosen.push(best);
  }
  return chosen.sort((a, b) => a - b);
}

function spanOf(pts: Pt[]): number {
  const xs = pts.map((pt) => pt[0]);
  const ys = pts.map((pt) => pt[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function closedEnough(pts: Pt[]): boolean {
  return gap(pts[0], pts[pts.length - 1]) <= spanOf(pts) * 0.22;
}

function interior(prev: Pt, corner: Pt, next: Pt): number {
  return angleBetween([prev[0] - corner[0], prev[1] - corner[1]], [next[0] - corner[0], next[1] - corner[1]]);
}

function angleBetween(a: Pt, b: Pt): number {
  const denom = Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]) || 1;
  const cos = Math.min(1, Math.max(-1, (a[0] * b[0] + a[1] * b[1]) / denom));
  return (Math.acos(cos) * 180) / Math.PI;
}

function lineDistance(point: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs(dx * (a[1] - point[1]) - dy * (a[0] - point[0])) / len;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deviation(values: number[]): number {
  const mid = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - mid) ** 2)));
}

type Miss = { ok: false; reason: 'short' | 'open' | 'small' };

function polygonScore(pts: Pt[], corners: number, idealAngle: number): { ok: true; score: number } | Miss {
  if (pts.length < 24) return { ok: false, reason: 'short' };
  if (spanOf(pts) < 0.24) return { ok: false, reason: 'small' };
  if (!closedEnough(pts)) return { ok: false, reason: 'open' };
  let sample = resample(pts, 80);
  if (gap(sample[0], sample[sample.length - 1]) < 0.05) sample = sample.slice(0, -1);
  const found = pickPeaks(loopTurns(sample), corners, corners === 4 ? 8 : 10);
  if (found.length !== corners) return { ok: false, reason: 'open' };
  const nodes = found.map((index) => sample[index]);
  const sides = nodes.map((node, index) => gap(node, nodes[(index + 1) % nodes.length]));
  if (mean(sides) < 0.12) return { ok: false, reason: 'small' };
  const angles = nodes.map((node, index) => interior(nodes[(index + nodes.length - 1) % nodes.length], node, nodes[(index + 1) % nodes.length]));
  let straight = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    const from = found[index];
    const to = found[(index + 1) % found.length];
    const between: Pt[] = [];
    if (to > from) {
      for (let i = from + 1; i < to; i += 1) between.push(sample[i]);
    } else {
      for (let i = from + 1; i < sample.length; i += 1) between.push(sample[i]);
      for (let i = 0; i < to; i += 1) between.push(sample[i]);
    }
    const side = sides[index] || 1;
    straight += between.length ? mean(between.map((point) => lineDistance(point, nodes[index], nodes[(index + 1) % nodes.length]))) / side : 0;
  }
  straight /= nodes.length;
  const cv = deviation(sides) / mean(sides);
  const angleErr = mean(angles.map((angle) => Math.abs(angle - idealAngle)));
  const score = round2(Math.max(0, Math.min(100, 100 - cv * 130 - angleErr * 1.2 - straight * 80)));
  return { ok: true, score };
}

export function squareScore(pts: Pt[]): { ok: true; score: number } | Miss {
  return polygonScore(pts, 4, 90);
}

export function triangleScore(pts: Pt[]): { ok: true; score: number } | Miss {
  return polygonScore(pts, 3, 60);
}

export function angleScore(pts: Pt[]): { ok: true; score: number } | Miss {
  if (pts.length < 16) return { ok: false, reason: 'short' };
  if (spanOf(pts) < 0.22) return { ok: false, reason: 'small' };
  const sample = resample(pts, 48);
  let corner = 1;
  let best = 0;
  for (let i = 1; i < sample.length - 1; i += 1) {
    const turn = turnDeg(sample, i);
    if (turn > best) {
      best = turn;
      corner = i;
    }
  }
  if (best < 40) return { ok: false, reason: 'open' };
  const before = sample.slice(0, corner + 1);
  const after = sample.slice(corner);
  const arm = (part: Pt[]) => part.reduce((sum, point, index) => (index ? sum + gap(part[index - 1], point) : 0), 0);
  if (arm(before) < 0.16 || arm(after) < 0.16) return { ok: false, reason: 'short' };
  const origin = sample[corner];
  const bend = interior(sample[0], origin, sample[sample.length - 1]);
  const left = before.slice(1, -1).map((point) => lineDistance(point, sample[0], origin));
  const right = after.slice(1, -1).map((point) => lineDistance(point, origin, sample[sample.length - 1]));
  const wobble = ((left.length ? mean(left) : 0) + (right.length ? mean(right) : 0)) / 2;
  const score = round2(Math.max(0, Math.min(100, 100 - Math.abs(bend - 90) * 2.1 - wobble * 50)));
  return { ok: true, score };
}

export function scoreTask(task: ShapeTask, pts: Pt[]): { ok: true; score: number } | Miss {
  if (task === 'square') return squareScore(pts);
  if (task === 'triangle') return triangleScore(pts);
  if (task === 'angle') return angleScore(pts);
  return circleScore(pts);
}

export function verify(score: number, meta: unknown, serverDate?: string): { ok: true; score: number } | { ok: false } {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { ok: false };
  const body = meta && typeof meta === 'object' ? (meta as { pts?: unknown; task?: unknown }) : {};
  const pts = body.pts;
  if (!Array.isArray(pts) || pts.length < 16 || pts.length > 200) return { ok: false };
  const clean: Pt[] = [];
  for (const pt of pts) {
    if (!Array.isArray(pt) || pt.length !== 2) return { ok: false };
    const [x, y] = pt;
    if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x > 1 || y < 0 || y > 1) return { ok: false };
    clean.push([x, y]);
  }
  const named = body.task === 'square' || body.task === 'angle' || body.task === 'triangle' || body.task === 'circle' ? body.task : 'circle';
  const expected = serverDate ? taskForWeekday(kstWeekday(dateFromKey(serverDate))) : 'circle';
  if (!expected || named !== expected) return { ok: false };
  const judged = scoreTask(expected, clean);
  if (!judged.ok) return { ok: false };
  if (Math.abs(judged.score - score) > 0.05) return { ok: false };
  return { ok: true, score: judged.score };
}
