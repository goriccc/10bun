import { LUNCH_BUDGETS, LUNCH_MENUS } from '@/content/lunch';
import { dateFromKey, kstDateKey, kstWeekday, shiftDateKey } from '@/lib/daily';
import { siteUrl } from '@/content/site';

export type LunchLink = { budget: number; veto: number[]; pick: number | null; unused: boolean };

export function menusFor(budget: number, veto: number[]): string[] {
  const name = LUNCH_BUDGETS[budget] ?? LUNCH_BUDGETS[0];
  return LUNCH_MENUS[name].filter((_, index) => !veto.includes(index));
}

export function mondayKey(key = kstDateKey()): string {
  const weekday = kstWeekday(dateFromKey(key));
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return shiftDateKey(key, delta);
}

export function lunchHref(link: LunchLink, medium: 'native' | 'copy' | string, key = kstDateKey()): string {
  const utm = medium === 'native' ? 'native' : 'copy';
  const url = new URL(`${siteUrl().replace(/\/$/, '')}/lunch`);
  url.searchParams.set('b', String(link.budget));
  url.searchParams.set('v', link.veto.join('.'));
  if (link.pick != null) url.searchParams.set('p', String(link.pick));
  url.searchParams.set('u', link.unused ? '1' : '0');
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', utm);
  url.searchParams.set('utm_campaign', 'lunch');
  url.searchParams.set('utm_content', key.replaceAll('-', ''));
  return url.toString();
}

export function readLunch(search: string): LunchLink | null {
  const params = new URLSearchParams(search);
  if (!params.has('p') && !params.has('b')) return null;
  const budget = Number(params.get('b'));
  if (!Number.isInteger(budget) || budget < 0 || budget > 2) return null;
  const veto = (params.get('v') ?? '')
    .split('.')
    .filter(Boolean)
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0 && index < 8);
  const pickRaw = params.get('p');
  const pick = pickRaw == null || pickRaw === '' ? null : Number(pickRaw);
  if (pick != null && (!Number.isInteger(pick) || pick < 0 || pick > 7 || veto.includes(pick))) return null;
  return { budget, veto: [...new Set(veto)], pick, unused: params.get('u') !== '0' };
}
