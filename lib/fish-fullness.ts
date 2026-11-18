import { kstHour } from '@/lib/daily';

/** `bun_fish_fullness`와 같은 감소. fromMs·toMs는 epoch ms. */
export function decayFishFullness(fullness: number, fromMs: number, toMs = Date.now()): number {
  if (!Number.isFinite(fullness)) return 0;
  if (toMs <= fromMs || fullness <= 0) return Math.max(fullness, 0);
  let v = fullness;
  let t = fromMs;
  const step = 60_000;
  while (t < toMs && v > 0) {
    const rate = (() => {
      const hour = kstHour(new Date(t));
      return hour >= 8 && hour < 22 ? 100 / 720 : 100 / 2160;
    })();
    const dtSec = Math.min(toMs - t, step) / 1000;
    v -= rate * dtSec;
    t += step;
  }
  if (v < 0) v = 0;
  return Math.round(v * 100) / 100;
}

export function formatFishFullness(fullness: number): string {
  const n = Math.max(0, fullness);
  if (n <= 0) return '0';
  if (n < 10) return (Math.round(n * 10) / 10).toFixed(1);
  return String(Math.round(n));
}

export function fishToneLabel(fullness?: number): string {
  if (fullness == null || !Number.isFinite(fullness)) return '';
  if (fullness <= 0) return ' · 떠났어요';
  if (fullness < 15) return ' · 굶주림';
  if (fullness < 30) return ' · 배고파요';
  if (fullness <= 80) return '';
  return ' · 과식 위험';
}
