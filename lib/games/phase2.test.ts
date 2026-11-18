import { describe, expect, it } from 'vitest';
import { assertPriceSources, prices } from '@/content/prices';
import { dongneScore, haversineKm } from './dongne';
import { decodeStrokes, encodeStrokes, todayWord } from './draw';
import { lunchHref, menusFor, readLunch } from './lunch';
import { pricePoint, priceTotal, priceWon, todayPrices, verify as verifyPrice } from './price';
import { shiftDateKey } from '@/lib/daily';
import { angleScore, squareScore, triangleScore, verify as verifyShape, type Pt } from './shape';
import { wearOutfit } from '@/content/wear';

function edge(a: Pt, b: Pt, steps = 16): Pt[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    return [Math.round((a[0] + (b[0] - a[0]) * t) * 1000) / 1000, Math.round((a[1] + (b[1] - a[1]) * t) * 1000) / 1000] as Pt;
  });
}

function join(parts: Pt[][]): Pt[] {
  return parts.flatMap((part, index) => (index === 0 ? part : part.slice(1)));
}

describe('2단계 채점', () => {
  it('가격은 맞히면 200점, 다섯 개면 1000점', () => {
    expect(pricePoint(100, 100)).toBe(200);
    expect(priceTotal([2, 4, 8, 16, 32], [2, 4, 8, 16, 32])).toBe(1000);
    expect(prices.length).toBeGreaterThanOrEqual(60);
    const rough = prices.find((item) => item.approx);
    const exact = prices.find((item) => !item.approx);
    expect(rough && priceWon(rough).startsWith('약 ')).toBe(true);
    expect(exact && priceWon(exact).endsWith('원') && !priceWon(exact).startsWith('약')).toBe(true);
    expect(() => assertPriceSources(prices)).not.toThrow();
    expect(() => assertPriceSources([{ ...prices[0], price: 0 }])).toThrow();
    expect(() => assertPriceSources([prices[0], prices[0]])).toThrow();
    expect(() => assertPriceSources([{ ...prices[0], source_url: '' }])).toThrow();
  });

  it('하루 가격 5개는 그룹이 다르고 30일 안에 같은 품목이 없다', () => {
    const first = todayPrices('2026-11-15');
    expect(todayPrices('2026-11-15').map((item) => item.id)).toEqual(first.map((item) => item.id));
    expect(new Set(first.map((item) => item.group)).size).toBe(5);
    expect(new Set(first.map((item) => item.category)).size).toBeGreaterThanOrEqual(3);
    const lastSeen = new Map<string, string>();
    let cursor = '2026-11-15';
    for (let day = 0; day < 40; day += 1) {
      const picks = todayPrices(cursor);
      expect(new Set(picks.map((item) => item.id)).size).toBe(5);
      expect(new Set(picks.map((item) => item.group)).size).toBe(5);
      expect(new Set(picks.map((item) => item.category)).size).toBeGreaterThanOrEqual(3);
      for (const item of picks) {
        const prev = lastSeen.get(item.id);
        if (prev) {
          const gap = Math.round((Date.parse(`${cursor}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`)) / 86400000);
          expect(gap).toBeGreaterThan(30);
        }
        lastSeen.set(item.id, cursor);
      }
      cursor = shiftDateKey(cursor, 1);
    }
    const guesses = first.map((item) => item.price);
    const score = priceTotal(guesses, first.map((item) => item.price));
    expect(verifyPrice('2026-11-15', score, { ids: first.map((item) => item.id), guesses })).toEqual({ ok: true, score });
    expect(verifyPrice('2026-11-15', score, { ids: first.map((item) => item.id), guesses: [1, 1, 1, 1, 1] }).ok).toBe(false);
  });

  it('동네 점수는 시도 수와 초로 만들고 실패는 7000부터', () => {
    expect(dongneScore(true, 3, 12)).toBe(3012);
    expect(dongneScore(false, 6, 40)).toBe(7040);
    expect(haversineKm([37.5, 127], [37.5, 127])).toBe(0);
  });

  it('기온과 성별, 스타일로 코디를 고른다', () => {
    expect(wearOutfit(12, 'f', 'casual').main).toBe('데님 재킷 + 니트');
    expect(wearOutfit(30, 'm', 'casual').main).toBe('반팔 티 + 면 반바지');
  });

  it('정사각형, 직각, 정삼각형은 높은 점수가 나온다', () => {
    const square = join([
      edge([0.22, 0.22], [0.78, 0.22]),
      edge([0.78, 0.22], [0.78, 0.78]),
      edge([0.78, 0.78], [0.22, 0.78]),
      edge([0.22, 0.78], [0.22, 0.22]),
    ]);
    const squareJudged = squareScore(square);
    expect(squareJudged.ok).toBe(true);
    if (squareJudged.ok) expect(squareJudged.score).toBeGreaterThan(80);
    expect(verifyShape(squareJudged.ok ? squareJudged.score : 0, { task: 'square', pts: square }, '2026-11-17').ok).toBe(true);

    const angle = join([edge([0.2, 0.25], [0.2, 0.78]), edge([0.2, 0.78], [0.78, 0.78])]);
    const angleJudged = angleScore(angle);
    expect(angleJudged.ok).toBe(true);
    if (angleJudged.ok) expect(angleJudged.score).toBeGreaterThan(80);

    const tri = join([
      edge([0.5, 0.18], [0.82, 0.74]),
      edge([0.82, 0.74], [0.18, 0.74]),
      edge([0.18, 0.74], [0.5, 0.18]),
    ]);
    const triJudged = triangleScore(tri);
    expect(triJudged.ok).toBe(true);
    if (triJudged.ok) expect(triJudged.score).toBeGreaterThan(70);
  });

  it('주말 도형 제출은 순위에 들어가지 않는다', () => {
    const circle = Array.from({ length: 61 }, (_, index) => {
      const a = (index / 60) * Math.PI * 2;
      return [Math.round((0.5 + Math.cos(a) * 0.32) * 1000) / 1000, Math.round((0.5 + Math.sin(a) * 0.32) * 1000) / 1000] as Pt;
    });
    expect(verifyShape(90, { task: 'circle', pts: circle }, '2026-11-14').ok).toBe(false);
  });

  it('점심 링크는 거부 목록을 왕복한다', () => {
    const href = lunchHref({ budget: 0, veto: [1], pick: 3, unused: true }, 'copy', '2026-11-16');
    const read = readLunch(new URL(href).search);
    expect(read).toMatchObject({ budget: 0, veto: [1], pick: 3, unused: true });
    expect(menusFor(0, [1])).not.toContain('제육볶음');
  });

  it('그림 좌표는 링크 안에서 복원되고 제시어는 날짜로 정해진다', () => {
    const strokes: Pt[][] = [
      [
        [0.1, 0.2],
        [0.4, 0.5],
        [0.8, 0.3],
      ],
    ];
    const back = decodeStrokes(encodeStrokes(strokes));
    expect(back).toHaveLength(1);
    expect(back[0][0][0]).toBeCloseTo(0.1, 1);
    expect(back[0][1][0]).toBeCloseTo(0.8, 1);
    expect(todayWord('2026-11-14')).toBe(todayWord('2026-11-14'));
  });
});
