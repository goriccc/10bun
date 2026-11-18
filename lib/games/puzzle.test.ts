import { describe, expect, it } from 'vitest';
import { dowOf, makePuzzle, manhattan, replay, sizeFor, verify } from './puzzle';

function solvable(p: { n: number; tiles: number[] }): boolean {
  const { n, tiles } = p;
  const a = tiles.filter((v) => v);
  let inv = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i]! > a[j]!) inv += 1;
  if (n % 2 === 1) return inv % 2 === 0;
  const rowFromBottom = n - Math.floor(tiles.indexOf(0) / n);
  return (inv + rowFromBottom) % 2 === 1;
}

describe('puzzle', () => {
  it('365일 생성·결정적·크기 규칙·풀이 가능', () => {
    const sizes: Record<number, number> = { 3: 0, 4: 0, 5: 0 };
    const man: Record<number, [number, number]> = {
      3: [1e9, 0],
      4: [1e9, 0],
      5: [1e9, 0],
    };
    const d0 = new Date(Date.UTC(2026, 11, 1));
    for (let i = 0; i < 365; i++) {
      const d = new Date(d0.getTime() + i * 864e5);
      const key = d.toISOString().slice(0, 10);
      const p = makePuzzle(key);
      const p2 = makePuzzle(key);
      expect(p).toEqual(p2);
      expect(p.n).toBe(sizeFor(key));
      expect([3, 4]).toContain(p.n);
      expect(solvable(p)).toBe(true);
      const m = manhattan(p.tiles, p.n);
      sizes[p.n] = (sizes[p.n] ?? 0) + 1;
      man[p.n] = [Math.min(man[p.n]![0], m), Math.max(man[p.n]![1], m)];
    }
    expect(sizes[5]).toBe(0);
    expect((sizes[3] ?? 0) + (sizes[4] ?? 0)).toBe(365);
    expect(man[3]![0]).toBeGreaterThanOrEqual(14);
    expect(man[4]![0]).toBeGreaterThanOrEqual(34);
    expect(man[4]![1]).toBeLessThanOrEqual(48);
  });

  it('위조 이동은 거부하고 3×3 BFS 풀이는 통과', () => {
    const p = makePuzzle('2026-12-02');
    expect(p.n).toBe(sizeFor('2026-12-02'));
    const bogus = replay(p, 'UDLR');
    expect(bogus === -1 || bogus === 4).toBe(true);
    expect(replay(p, '')).toBe(-1);

    const key = '2026-12-07';
    const q = makePuzzle(key, 3);
    const goal = '123456780';
    const start = q.tiles.join('');
    const prev = new Map<string, [string, string] | null>([[start, null]]);
    let fr = [start];
    let found = false;
    const dirs: [string, number][] = [
      ['U', -3],
      ['D', 3],
      ['L', -1],
      ['R', 1],
    ];
    while (fr.length && !found) {
      const nx: string[] = [];
      for (const st of fr) {
        const b = st.indexOf('0');
        const r = Math.floor(b / 3);
        const c = b % 3;
        for (const [ch, dl] of dirs) {
          if ((ch === 'U' && r === 0) || (ch === 'D' && r === 2) || (ch === 'L' && c === 0) || (ch === 'R' && c === 2)) continue;
          const a = st.split('');
          a[b] = a[b + dl]!;
          a[b + dl] = '0';
          const ns = a.join('');
          if (!prev.has(ns)) {
            prev.set(ns, [st, ch]);
            if (ns === goal) {
              found = true;
              break;
            }
            nx.push(ns);
          }
        }
        if (found) break;
      }
      fr = nx;
    }
    let path = '';
    let cur = goal;
    while (prev.get(cur)) {
      const step = prev.get(cur)!;
      path = step[1] + path;
      cur = step[0];
    }
    expect(replay(q, path)).toBe(path.length);
    expect(replay(q, path.slice(0, -1))).toBe(-1);
    expect(verify(key, Math.round((path.length * 200) / 10) / 100, { n: 3, moves: path, solveMs: path.length * 200 }).ok).toBe(false);
  });

  it('sizeFor 평일 격일·주말 4', () => {
    expect(dowOf('2026-12-04')).toBe(5); // 금
    expect(sizeFor('2026-12-04')).toBe(3); // 20261204 even → 3
    expect(sizeFor('2026-12-03')).toBe(4); // 목, odd → 4
    expect(sizeFor('2026-12-05')).toBe(4); // 토
    expect(sizeFor('2026-12-06')).toBe(4); // 일
  });
});
