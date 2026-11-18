import { describe, expect, it } from 'vitest';
import sggFile from '@/content/dongne-sgg.json';
import { DONGNE_CREDIT, dongneByLabel, dongnePlaces } from '@/content/dongne';
import { shiftDateKey } from '@/lib/daily';
import { arrowOf, bearingDeg, closeness, dongneScore, haversineKm, shareRow, todayDongne, verify } from '@/lib/games/dongne';
import { todayDongneView, todaySido } from '@/lib/games/dongne-shape';

const shapes = sggFile as { items: { code: string; label: string; path: string }[] };

describe('오늘의 동네', () => {
  it('색인은 229개 라벨이고 실루엣은 없다', () => {
    expect(dongnePlaces).toHaveLength(229);
    expect(DONGNE_CREDIT).toBe('자료: 국가데이터처 센서스 경계(2025.06)');
    expect(dongneByLabel('세종시')?.code).toBe('29010');
    expect(dongneByLabel('강원 고성군')?.code).not.toBe(dongneByLabel('경남 고성군')?.code);
    expect(shapes.items.map((item) => item.code)).toEqual(dongnePlaces.map((item) => item.code));
    expect(dongnePlaces.every((item) => !('path' in item))).toBe(true);
  });

  it('같은 날 문제는 같고 180일 안에는 다시 나오지 않는다', () => {
    const first = todayDongne('2026-11-15');
    expect(todayDongne('2026-11-15').code).toBe(first.code);
    const seen = new Map<string, string>();
    let cursor = '2026-11-15';
    for (let day = 0; day < 200; day += 1) {
      const place = todayDongne(cursor);
      const prev = seen.get(place.code);
      if (prev) {
        const gap = Math.round((Date.parse(`${cursor}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`)) / 86400000);
        expect(gap).toBeGreaterThan(180);
      }
      seen.set(place.code, cursor);
      cursor = shiftDateKey(cursor, 1);
    }
  });

  it('오늘 페이지에는 정답 실루엣 하나만 있다', () => {
    const day = todayDongneView('2026-11-15');
    const shape = shapes.items.find((item) => item.code === day.code);
    expect(day.path).toBe(shape?.path);
    expect(day.sidos).toHaveLength(17);
    expect(day.sidos.some((item) => 'path' in item)).toBe(false);
    expect(day.easyPath.length).toBeGreaterThan(20);
    const again = todaySido('2026-11-15');
    expect(again.code).toBe(day.easyCode);
    const easySeen = new Map<string, string>();
    let cursor = '2026-11-15';
    for (let dayIndex = 0; dayIndex < 20; dayIndex += 1) {
      const place = todaySido(cursor);
      const prev = easySeen.get(place.code);
      if (prev) {
        const gap = Math.round((Date.parse(`${cursor}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`)) / 86400000);
        expect(gap).toBeGreaterThan(10);
      }
      easySeen.set(place.code, cursor);
      cursor = shiftDateKey(cursor, 1);
    }
  });

  it('방향은 8방위이고 맞히면 초록, 실패는 7000부터', () => {
    expect(haversineKm([37.5, 127], [37.5, 127])).toBe(0);
    expect(arrowOf(bearingDeg([36, 127], [37, 127]))).toBe('↑');
    expect(arrowOf(bearingDeg([36, 127], [36, 128]))).toBe('→');
    expect(arrowOf(bearingDeg([36, 127], [35, 127]))).toBe('↓');
    expect(arrowOf(bearingDeg([36, 127], [36, 126]))).toBe('←');
    expect(closeness(0)).toBe(100);
    expect(closeness(500)).toBe(0);
    expect(shareRow(0, 0)).toBe('🟩🟩🟩 정답');
    expect(shareRow(64, 90)).toContain('🟨🟨⬜');
    const answer = todayDongne('2026-11-15').label;
    const other = dongnePlaces.find((item) => item.label !== answer)!;
    const win = dongneScore(true, 2, 12);
    expect(verify('2026-11-15', win, { guesses: [other.label, answer], seconds: 12 })).toEqual({ ok: true, score: win });
    const lose = dongneScore(false, 6, 40);
    const misses = dongnePlaces.filter((item) => item.label !== answer).slice(0, 6).map((item) => item.label);
    expect(verify('2026-11-15', lose, { guesses: misses, seconds: 40 })).toEqual({ ok: true, score: 7040 });
    expect(verify('2026-11-15', win, { guesses: [answer, other.label], seconds: 12 }).ok).toBe(false);
    expect(verify('2026-11-15', win, { guesses: ['중구'], seconds: 12 }).ok).toBe(false);
  });
});
