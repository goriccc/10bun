import { describe, expect, it } from 'vitest';
import { round3, targetSeconds, verify } from './10sec';

describe('10sec', () => {
  it('목표 시간은 5.00초에서 12.99초', () => {
    const target = targetSeconds('2026-11-14');
    expect(target).toBeGreaterThanOrEqual(5);
    expect(target).toBeLessThan(13);
    expect(targetSeconds('2026-11-14')).toBe(target);
  });

  it('서버가 다시 계산한 점수와 맞을 때만 통과', () => {
    const target = targetSeconds('2026-11-14');
    const gameElapsed = round3(target + 0.25);
    const score = round3(Math.abs(gameElapsed - target));
    const ok = verify('2026-11-14', score, { gameElapsed });
    expect(ok).toEqual({ ok: true, score });
    expect(verify('2026-11-14', score + 0.01, { gameElapsed }).ok).toBe(false);
    expect(verify('2026-11-14', score, { gameElapsed: 1.2 }).ok).toBe(false);
  });
});
