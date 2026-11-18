import { describe, expect, it } from 'vitest';
import { daily, kstDateKey, kstSeed, msUntilKstMidnight, mulberry32 } from './daily';

describe('kst', () => {
  it('자정 직전과 직후가 하루 차이', () => {
    const before = new Date('2026-11-13T14:59:59.000Z');
    const after = new Date('2026-11-13T15:00:00.000Z');
    expect(kstDateKey(before)).toBe('2026-11-13');
    expect(kstDateKey(after)).toBe('2026-11-14');
    expect(kstSeed(before)).toBe(20261113);
    expect(kstSeed(after)).toBe(20261114);
    expect(msUntilKstMidnight(before)).toBe(1000);
    expect(msUntilKstMidnight(after)).toBe(24 * 60 * 60 * 1000);
  });

  it('같은 시드는 같은 난수', () => {
    const a = mulberry32(20261114);
    const b = mulberry32(20261114);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const roll = daily(1, new Date('2026-11-14T03:00:00+09:00'))();
    expect(roll).toBeGreaterThanOrEqual(0);
    expect(roll).toBeLessThan(1);
  });
});
