import { daily, dateFromKey } from '../daily';

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function targetSeconds(serverDate: string): number {
  return (500 + Math.floor(daily(1, dateFromKey(serverDate))() * 800)) / 100;
}

export function verify(
  serverDate: string,
  score: number,
  meta: unknown,
): { ok: true; score: number } | { ok: false } {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { ok: false };
  if (!meta || typeof meta !== 'object') return { ok: false };
  const elapsed = (meta as { gameElapsed?: unknown }).gameElapsed;
  if (typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < 1.5 || elapsed > 60) {
    return { ok: false };
  }
  const calc = round3(Math.abs(elapsed - targetSeconds(serverDate)));
  if (Math.abs(calc - score) > 0.0015) return { ok: false };
  return { ok: true, score: calc };
}
