import { prices, type PriceItem } from '@/content/prices';
import { daily, dateFromKey, shiftDateKey } from '@/lib/daily';

/** 카탈로그를 돌리기 시작한 날. 이 날 이전 기록은 없다. */
const PRICE_START = '2026-11-15';

const cache = new Map<string, PriceItem[]>();

export function pricePoint(guess: number, price: number): number {
  if (!(guess > 0) || !(price > 0)) return 0;
  return Math.round(200 * Math.exp(-2 * Math.abs(Math.log(guess / price))));
}

export function priceTotal(guesses: number[], answers: number[]): number {
  if (guesses.length !== 5 || answers.length !== 5) return 0;
  return guesses.reduce((sum, guess, index) => sum + pricePoint(guess, answers[index]), 0);
}

/** 오차 10% 이내 3, 25% 이내 2, 50% 이내 1. 순위 점수는 pricePoint를 쓴다. */
export function priceStars(guess: number, price: number): number {
  if (!(guess > 0) || !(price > 0)) return 0;
  const error = Math.abs(guess - price) / price;
  if (error <= 0.1) return 3;
  if (error <= 0.25) return 2;
  if (error <= 0.5) return 1;
  return 0;
}

export function priceLabel(item: PriceItem): string {
  return `${item.year}년 ${item.name} (${item.unit})`;
}

export function priceWon(item: PriceItem): string {
  const amount = `${item.price.toLocaleString('ko-KR')}원`;
  return item.approx ? `약 ${amount}` : amount;
}

function bannedIds(dateKey: string, days: number): Set<string> {
  const banned = new Set<string>();
  let cursor = dateKey;
  for (let i = 0; i < days; i += 1) {
    cursor = shiftDateKey(cursor, -1);
    if (cursor < PRICE_START) break;
    for (const item of todayPrices(cursor)) banned.add(item.id);
  }
  return banned;
}

function choose(dateKey: string, banned: Set<string>): PriceItem[] | null {
  const rand = daily(4, dateFromKey(dateKey));
  const order = prices.filter((item) => !banned.has(item.id));
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  const picked: PriceItem[] = [];
  const groups = new Set<string>();
  const categories = new Set<string>();
  const take = (freshCategory: boolean) => {
    const index = order.findIndex((item) => !groups.has(item.group) && (!freshCategory || !categories.has(item.category)));
    if (index < 0) return false;
    const [item] = order.splice(index, 1);
    picked.push(item);
    groups.add(item.group);
    categories.add(item.category);
    return true;
  };
  while (picked.length < 5 && categories.size < 3) {
    if (!take(true)) break;
  }
  while (picked.length < 5) {
    if (!take(false)) break;
  }
  return picked.length === 5 ? picked : null;
}

/** 하루 5품목. 그룹은 모두 다르고, 범주는 3개 이상을 우선한다. 최근 30일 id는 뺀다. */
export function todayPrices(dateKey: string): PriceItem[] {
  const hit = cache.get(dateKey);
  if (hit) return hit;
  let picked: PriceItem[] | null = null;
  const span = dateKey > PRICE_START ? 30 : 0;
  for (let days = span; days >= 0 && !picked; days -= 1) picked = choose(dateKey, bannedIds(dateKey, days));
  if (!picked) throw new Error('price day is short');
  cache.set(dateKey, picked);
  return picked;
}

export function verify(serverDate: string, score: number, meta: unknown): { ok: true; score: number } | { ok: false } {
  if (!meta || typeof meta !== 'object') return { ok: false };
  const body = meta as { ids?: unknown; guesses?: unknown };
  if (!Array.isArray(body.ids) || !Array.isArray(body.guesses) || body.guesses.length !== 5) return { ok: false };
  const day = todayPrices(serverDate);
  if (body.ids.join('|') !== day.map((item) => item.id).join('|')) return { ok: false };
  const guesses = body.guesses.map((value) => (typeof value === 'number' ? value : Number.NaN));
  if (guesses.some((guess) => !Number.isInteger(guess) || guess <= 0 || guess > 999_999_999)) return { ok: false };
  const total = priceTotal(guesses, day.map((item) => item.price));
  if (total !== score) return { ok: false };
  return { ok: true, score: total };
}
