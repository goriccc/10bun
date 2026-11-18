/** 오늘의 슬라이드 퍼즐. reference/puzzle.ref.mjs 와 같은 로직. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function kstSeedOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return y * 10000 + m * 100 + d;
}

export function dowOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 평일은 격일로 3×3 / 4×4, 토·일은 4×4 */
export function sizeFor(key: string): number {
  const w = dowOf(key);
  if (w === 0 || w === 6) return 4;
  return kstSeedOf(key) % 2 === 0 ? 3 : 4;
}

const MIN_MANHATTAN: Record<number, number> = { 3: 14, 4: 34, 5: 60 };
const WALK: Record<number, number> = { 3: 80, 4: 160, 5: 300 };

export type Puzzle = { n: number; tiles: number[] };

export function manhattan(t: number[], n: number): number {
  let s = 0;
  for (let i = 0; i < t.length; i++) {
    const v = t[i];
    if (!v) continue;
    const g = v - 1;
    s += Math.abs(Math.floor(i / n) - Math.floor(g / n)) + Math.abs((i % n) - (g % n));
  }
  return s;
}

export function makePuzzle(dateKey: string, size?: number, seed?: number): Puzzle {
  const n = size || sizeFor(dateKey);
  const rnd = mulberry32(seed ?? kstSeedOf(dateKey) * 97 + 15 * 7919);
  const t = Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
  let b = n * n - 1;
  let prev = -1;
  let steps = 0;
  while (steps < WALK[n] || manhattan(t, n) < MIN_MANHATTAN[n]) {
    const nb: number[] = [];
    const r = Math.floor(b / n);
    const c = b % n;
    if (r > 0) nb.push(b - n);
    if (r < n - 1) nb.push(b + n);
    if (c > 0) nb.push(b - 1);
    if (c < n - 1) nb.push(b + 1);
    const cand = nb.filter((x) => x !== prev);
    const x = cand[Math.floor(rnd() * cand.length)];
    t[b] = t[x];
    t[x] = 0;
    prev = b;
    b = x;
    steps += 1;
    if (steps > 5000) throw new Error('gen fail');
  }
  if (t.every((v, i) => v === (i + 1) % (n * n))) throw new Error('solved');
  return { n, tiles: t };
}

/** 이동 기록: 한 글자 = 빈칸이 움직인 방향 U/D/L/R. 풀리면 이동 횟수, 아니면 -1 */
export function replay(p: Puzzle, moves: string): number {
  const n = p.n;
  const t = p.tiles.slice();
  let b = t.indexOf(0);
  for (const ch of moves) {
    const r = Math.floor(b / n);
    const c = b % n;
    let x = -1;
    if (ch === 'U' && r > 0) x = b - n;
    else if (ch === 'D' && r < n - 1) x = b + n;
    else if (ch === 'L' && c > 0) x = b - 1;
    else if (ch === 'R' && c < n - 1) x = b + 1;
    else return -1;
    t[b] = t[x];
    t[x] = 0;
    b = x;
  }
  return t.every((v, i) => v === (i + 1) % (n * n)) ? moves.length : -1;
}

const MIN_SOLVE_MS: Record<number, number> = { 3: 2000, 4: 4000, 5: 8000 };

export function verify(
  serverDate: string,
  score: number,
  meta: unknown,
): { ok: true; score: number } | { ok: false } {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { ok: false };
  if (!meta || typeof meta !== 'object') return { ok: false };
  const bag = meta as { n?: unknown; moves?: unknown; solveMs?: unknown };
  if (typeof bag.n !== 'number' || typeof bag.moves !== 'string' || typeof bag.solveMs !== 'number') return { ok: false };
  if (!Number.isFinite(bag.solveMs) || bag.solveMs < 0) return { ok: false };
  if (bag.moves.length > 600 || !/^[UDLR]*$/.test(bag.moves)) return { ok: false };
  const puzzle = makePuzzle(serverDate);
  if (bag.n !== puzzle.n) return { ok: false };
  const steps = replay(puzzle, bag.moves);
  if (steps < 0 || steps !== bag.moves.length) return { ok: false };
  const computed = Math.round(bag.solveMs / 10) / 100;
  if (Math.abs(computed - score) > 0.01) return { ok: false };
  if (Math.abs(bag.solveMs / 1000 - score) > 0.01) return { ok: false };
  if (bag.moves.length > 0 && bag.solveMs / bag.moves.length < 60) return { ok: false };
  const floor = MIN_SOLVE_MS[puzzle.n];
  if (floor != null && bag.solveMs < floor) return { ok: false };
  return { ok: true, score: computed };
}

/** 제출 시 elapsed 검사 (미리보기 3초 포함). start 라우트 밖에서도 쓸 수 있게 분리. */
export function elapsedOk(elapsed: number, solveMs: number): boolean {
  return elapsed - solveMs / 1000 >= 3.0;
}
