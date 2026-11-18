export function verify(score: number, meta: unknown): { ok: true; score: number } | { ok: false } {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { ok: false };
  const taps = meta && typeof meta === 'object' ? (meta as { taps?: unknown }).taps : undefined;
  if (!Array.isArray(taps) || taps.length !== 3) return { ok: false };
  if (!taps.every((tap) => typeof tap === 'number' && Number.isFinite(tap) && tap >= 100 && tap <= 2000)) return { ok: false };
  const mean = (taps[0] + taps[1] + taps[2]) / 3;
  if (Math.abs(mean - score) > 1) return { ok: false };
  return { ok: true, score: Math.round(mean) };
}
