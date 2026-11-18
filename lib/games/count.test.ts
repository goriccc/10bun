import { describe, expect, it } from 'vitest';
import { todayJar } from './count';

describe('today jar', () => {
  it('places the same candies for the same day', () => {
    const a = todayJar('2026-11-15');
    const b = todayJar('2026-11-15');
    expect(a.dots.length).toBeGreaterThan(100);
    expect(a.dots.length).toBeLessThanOrEqual(500);
    expect(b.dots).toEqual(a.dots);
    expect(todayJar('2026-11-16').dots).not.toEqual(a.dots);
  });
});
