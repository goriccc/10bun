import { daily, dateFromKey } from '../daily';

export type Op = '+' | '-' | '*' | '/';
export type Step = [number, Op, number];

const OPS = '+-×÷';

export type Puzzle = { nums: number[]; target: number; sample: string };

export function generatePuzzle(serverDate: string): Puzzle {
  const rand = daily(6, dateFromKey(serverDate));
  for (let tries = 0; tries < 8000; tries += 1) {
    const nums = [
      1 + Math.floor(rand() * 9),
      1 + Math.floor(rand() * 9),
      2 + Math.floor(rand() * 9),
      [10, 15, 20, 25][Math.floor(rand() * 4)],
      [25, 50, 75][Math.floor(rand() * 3)],
      1 + Math.floor(rand() * 12),
    ];
    const work = nums.map((v) => ({ v, e: String(v) }));
    const steps = 3 + Math.floor(rand() * 2);
    let ok = true;
    for (let s = 0; s < steps; s += 1) {
      const i = Math.floor(rand() * work.length);
      let j = Math.floor(rand() * (work.length - 1));
      if (j >= i) j += 1;
      const a = work[i];
      const b = work[j];
      const op = OPS[Math.floor(rand() * 4)];
      let v = Number.NaN;
      if (op === '+') v = a.v + b.v;
      else if (op === '-') v = a.v - b.v;
      else if (op === '×') v = a.v * b.v;
      else v = b.v && a.v % b.v === 0 ? a.v / b.v : Number.NaN;
      if (!Number.isFinite(v) || v <= 0 || (op === '×' && (a.v === 1 || b.v === 1)) || (op === '÷' && b.v === 1)) {
        ok = false;
        break;
      }
      const next = { v, e: `(${a.e} ${op} ${b.e})` };
      work.splice(Math.max(i, j), 1);
      work.splice(Math.min(i, j), 1);
      work.push(next);
    }
    const last = work[work.length - 1];
    if (ok && last && last.v >= 40 && last.v <= 600 && !nums.includes(last.v)) {
      return { nums, target: last.v, sample: last.e.replace(/^\((.*)\)$/, '$1') };
    }
  }
  throw new Error('오늘의 숫자 퍼즐을 만들지 못했어요');
}

export function replay(nums: number[], ops: Step[]): { slots: (number | null)[]; result: number | null } | null {
  if (nums.length !== 6) return null;
  const slots: (number | null)[] = nums.slice();
  let result: number | null = null;
  for (const step of ops) {
    if (!Array.isArray(step) || step.length !== 3) return null;
    const [i, op, j] = step;
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i > 5 || j > 5 || i === j) return null;
    if (op !== '+' && op !== '-' && op !== '*' && op !== '/') return null;
    const a = slots[i];
    const b = slots[j];
    if (a == null || b == null) return null;
    let v: number;
    if (op === '+') v = a + b;
    else if (op === '-') v = a - b;
    else if (op === '*') v = a * b;
    else {
      if (b === 0 || a % b !== 0) return null;
      v = a / b;
    }
    if (!Number.isFinite(v) || v <= 0) return null;
    slots[j] = v;
    slots[i] = null;
    result = v;
  }
  return { slots, result };
}

export function verify(
  serverDate: string,
  score: number,
  meta: unknown,
): { ok: true; score: number } | { ok: false } {
  if (typeof score !== 'number' || !Number.isInteger(score)) return { ok: false };
  if (!meta || typeof meta !== 'object') return { ok: false };
  const bag = meta as { solveSeconds?: unknown; ops?: unknown };
  if (bag.solveSeconds !== score || typeof bag.solveSeconds !== 'number' || bag.solveSeconds < 5) return { ok: false };
  if (!Array.isArray(bag.ops)) return { ok: false };
  const puzzle = generatePuzzle(serverDate);
  const played = replay(puzzle.nums, bag.ops as Step[]);
  if (!played || played.result !== puzzle.target) return { ok: false };
  return { ok: true, score };
}
