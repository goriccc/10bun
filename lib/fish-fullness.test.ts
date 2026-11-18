import { describe, expect, it } from 'vitest';
import { decayFishFullness, formatFishFullness } from '@/lib/fish-fullness';

describe('decayFishFullness', () => {
  it('drains about 100 over 12 daytime minutes', () => {
    const t0 = Date.parse('2026-11-18T12:00:00+09:00');
    expect(decayFishFullness(100, t0, t0 + 12 * 60 * 1000)).toBe(0);
    expect(decayFishFullness(100, t0, t0 + 6 * 60 * 1000)).toBeCloseTo(50, 0);
  });

  it('drains slower at night', () => {
    const t0 = Date.parse('2026-11-18T23:00:00+09:00');
    expect(decayFishFullness(100, t0, t0 + 12 * 60 * 1000)).toBeCloseTo(66.67, 0);
    expect(decayFishFullness(100, t0, t0 + 36 * 60 * 1000)).toBe(0);
  });

  it('keeps sub-one values until truly empty', () => {
    const t0 = Date.parse('2026-11-18T12:00:00+09:00');
    expect(decayFishFullness(0.4, t0, t0)).toBe(0.4);
    expect(formatFishFullness(0.4)).toBe('0.4');
    expect(formatFishFullness(0)).toBe('0');
  });
});
