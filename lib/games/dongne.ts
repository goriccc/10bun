import { dongneByLabel, dongnePlaces, type DongnePlace } from '@/content/dongne';
import { daily, dateFromKey, shiftDateKey } from '@/lib/daily';

/** 카탈로그를 돌리기 시작한 날. 이 날 이전 기록은 없다. */
const DONGNE_START = '2026-11-15';

const cache = new Map<string, DongnePlace>();

export const DONGNE_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const;

export function dongneScore(won: boolean, tries: number, seconds: number): number {
  const sec = Math.min(999, Math.max(0, Math.round(seconds)));
  const count = Math.min(6, Math.max(1, Math.round(tries)));
  return won ? count * 1000 + sec : 7000 + sec;
}

export function haversineKm(a: [number, number], b: [number, number]): number {
  const radius = 6371;
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 목업과 같은 방위각. 0이 북쪽, 시계 방향. */
export function bearingDeg(a: [number, number], b: [number, number]): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function arrowOf(bearing: number): (typeof DONGNE_ARROWS)[number] {
  return DONGNE_ARROWS[Math.round(bearing / 45) % 8];
}

export function closeness(km: number): number {
  if (km === 0) return 100;
  return Math.min(99, Math.max(0, Math.round(100 * (1 - km / 500))));
}

export function shareSquares(km: number): string {
  if (km === 0) return '🟩🟩🟩';
  if (km < 80) return '🟨🟨⬜';
  if (km < 200) return '🟨⬜⬜';
  return '⬜⬜⬜';
}

export function shareRow(km: number, bearing: number): string {
  if (km === 0) return '🟩🟩🟩 정답';
  return `${shareSquares(km)} ${arrowOf(bearing)} ${km.toLocaleString('ko-KR')}km`;
}

type Coded = { code: string };

/** 하루 하나. 최근 banDays 안에 나온 code는 빼고, 후보가 없으면 금지를 하루씩 줄인다. */
export function dailyPick<T extends Coded>(dateKey: string, salt: number, items: readonly T[], banDays: number, picked: Map<string, T>): T {
  const hit = picked.get(dateKey);
  if (hit) return hit;
  let choice: T | null = null;
  const span = dateKey > DONGNE_START ? banDays : 0;
  for (let days = span; days >= 0 && !choice; days -= 1) {
    const banned = new Set<string>();
    let cursor = dateKey;
    for (let i = 0; i < days; i += 1) {
      cursor = shiftDateKey(cursor, -1);
      if (cursor < DONGNE_START) break;
      banned.add(dailyPick(cursor, salt, items, banDays, picked).code);
    }
    const open = items.filter((item) => !banned.has(item.code));
    if (open.length === 0) continue;
    const rand = daily(salt, dateFromKey(dateKey));
    choice = open[Math.floor(rand() * open.length)];
  }
  if (!choice) throw new Error('dongne day is short');
  picked.set(dateKey, choice);
  return choice;
}

/** 오늘 시·군·구. KST 시드, 최근 180일은 피한다. */
export function todayDongne(dateKey: string): DongnePlace {
  return dailyPick(dateKey, 5, dongnePlaces, 180, cache);
}

export function verify(serverDate: string, score: number, meta: unknown): { ok: true; score: number } | { ok: false } {
  if (!meta || typeof meta !== 'object') return { ok: false };
  const body = meta as { guesses?: unknown; seconds?: unknown };
  if (!Array.isArray(body.guesses) || body.guesses.length < 1 || body.guesses.length > 6) return { ok: false };
  const labels = body.guesses.map((value) => (typeof value === 'string' ? value : ''));
  if (labels.some((label) => !dongneByLabel(label))) return { ok: false };
  if (new Set(labels).size !== labels.length) return { ok: false };
  const seconds = typeof body.seconds === 'number' ? body.seconds : Number.NaN;
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 999) return { ok: false };
  const answer = todayDongne(serverDate).label;
  const hit = labels.indexOf(answer);
  const won = hit === labels.length - 1;
  if (hit >= 0 && !won) return { ok: false };
  if (!won && labels.length !== 6) return { ok: false };
  const total = dongneScore(won, labels.length, seconds);
  if (total !== score) return { ok: false };
  return { ok: true, score: total };
}
