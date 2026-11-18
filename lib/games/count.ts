import { daily, dateFromKey } from '@/lib/daily';

const COLS = 7;

/** 오늘의 병. 정답은 점 개수고, 화면에는 점만 넘긴다. */
export function todayJar(key: string): { dots: { x: number; y: number; c: number }[] } {
  const rand = daily(11, dateFromKey(key));
  const n = 180 + Math.floor(rand() * 320);
  const dots: { x: number; y: number; c: number }[] = [];
  let tries = 0;
  while (dots.length < n && tries < n * 30) {
    tries += 1;
    const x = 62 + rand() * 176;
    const y = 96 + rand() * 196;
    const inside = ((x - 150) / 88) ** 2 + ((y - 200) / 104) ** 2 < 1 && y > 110;
    if (!inside) continue;
    const fill = 1 - (y - 96) / 196;
    if (rand() < fill * 0.35 && dots.length > n * 0.6) continue;
    dots.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, c: Math.floor(rand() * COLS) });
  }
  return { dots };
}
