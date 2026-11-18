import { describe, expect, it } from 'vitest';
import { shiftDateKey } from '../daily';
import { colorTotal, todayColors, verify as verifyColor } from './color';
import { circleScore, verify as verifyShape } from './shape';
import { generatePuzzle, replay, verify as verifyNumber } from './number';
import { verify as verifyReaction } from './reaction';
import { verifyScore } from './verify';

describe('오늘의 색', () => {
  it('같은 색은 10점, 다섯 색은 50점', () => {
    const colors = todayColors('2026-11-14');
    expect(colors).toHaveLength(5);
    for (const [h, s, b] of colors) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(360);
      expect(s).toBeGreaterThanOrEqual(35);
      expect(s).toBeLessThanOrEqual(95);
      expect(b).toBeGreaterThanOrEqual(42);
      expect(b).toBeLessThanOrEqual(97);
    }
    expect(colorTotal(colors, colors)).toBe(50);
    expect(verifyColor('2026-11-14', 50, { picks: colors }).ok).toBe(true);
  });
});

describe('오늘의 도형', () => {
  it('고른 원은 점수가 나오고 점 29개는 거절한다', () => {
    const pts = Array.from({ length: 61 }, (_, i) => {
      const a = (i / 60) * Math.PI * 2;
      return [Math.round((0.5 + Math.cos(a) * 0.32) * 1000) / 1000, Math.round((0.5 + Math.sin(a) * 0.32) * 1000) / 1000] as [number, number];
    });
    const judged = circleScore(pts);
    expect(judged.ok).toBe(true);
    if (judged.ok) expect(judged.score).toBeGreaterThan(90);
    expect(verifyShape(judged.ok ? judged.score : 0, { pts }).ok).toBe(true);
    expect(circleScore(pts.slice(0, 29)).ok).toBe(false);
  });
});

describe('오늘의 숫자', () => {
  it('365일 모두 풀이가 있는 문제를 낸다', () => {
    let key = '2026-01-01';
    for (let i = 0; i < 365; i += 1) {
      const puzzle = generatePuzzle(key);
      expect(puzzle.nums).toHaveLength(6);
      expect(puzzle.target).toBeGreaterThanOrEqual(40);
      expect(puzzle.target).toBeLessThanOrEqual(600);
      expect(puzzle.nums.includes(puzzle.target)).toBe(false);
      key = shiftDateKey(key, 1);
    }
  });

  it('5초 미만과 틀린 식은 거절한다', () => {
    const puzzle = generatePuzzle('2026-06-01');
    const ops = [[0, '+', 1]] as [number, '+' | '-' | '*' | '/', number][];
    expect(replay(puzzle.nums, ops)?.result).toBe(puzzle.nums[0] + puzzle.nums[1]);
    expect(verifyNumber('2026-06-01', 4, { solveSeconds: 4, ops }).ok).toBe(false);
    expect(verifyNumber('2026-06-01', 8, { solveSeconds: 8, ops }).ok).toBe(false);
  });
});

describe('반응속도', () => {
  it('세 번의 평균만 받는다', () => {
    expect(verifyReaction(200, { taps: [180, 200, 220] })).toEqual({ ok: true, score: 200 });
    expect(verifyReaction(200, { taps: [50, 200, 220] }).ok).toBe(false);
    expect(verifyScore(17, '2026-11-14', 200, { taps: [180, 200, 220] }).ok).toBe(true);
    expect(verifyScore(8, '2026-11-14', 1, {}).ok).toBe(false);
  });
});
