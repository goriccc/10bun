import { kstDateKey } from '@/lib/daily';
import { bunJson, CACHE_NONE } from '@/lib/http';
import { wearDefault, wearSpot } from '@/content/wear-points';
import { forecastBases, readVillage, villageUrl, type FcstItem } from '@/lib/games/wear';

export const runtime = 'nodejs';

const CACHE = 'public, s-maxage=60, stale-while-revalidate=10';
const memory = new Map<string, { at: number; report: WearReport }>();

type WearReport = {
  region: string;
  point: string;
  temp: number;
  low: number;
  high: number;
  pop: number | null;
  hours: { hour: number; temp: number }[];
  date: string;
};

function itemsOf(body: unknown): FcstItem[] {
  const response = body && typeof body === 'object' ? (body as { response?: { header?: { resultCode?: string }; body?: { items?: { item?: FcstItem | FcstItem[] } } } }).response : undefined;
  if (response?.header?.resultCode !== '00') return [];
  const item = response.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

async function loadFacts(nx: number, ny: number, key: string): Promise<ReturnType<typeof readVillage>> {
  for (const base of forecastBases()) {
    const url = villageUrl(key, { base_date: base.date, base_time: base.time, nx: String(nx), ny: String(ny) });
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('{')) continue;
      const items = itemsOf(JSON.parse(text) as unknown);
      const facts = readVillage(items);
      if (facts) return facts;
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const point = wearSpot(url.searchParams.get('code') ?? '') ?? wearDefault(url.searchParams.get('region') ?? '');
  if (!point) return bunJson({ ok: false, code: 'bad_region' }, 400);
  const key = process.env.KMA_SERVICE_KEY;
  if (!key) return bunJson({ ok: false, code: 'disabled' }, 200, CACHE_NONE);
  const cacheKey = `${point.nx},${point.ny},${kstDateKey()}`;
  const hit = memory.get(cacheKey);
  if (hit && Date.now() - hit.at < 60 * 1000) return bunJson({ ok: true, report: hit.report }, 200, CACHE);
  const facts = await loadFacts(point.nx, point.ny, key);
  if (!facts) return bunJson({ ok: false, code: 'upstream' }, 200, CACHE_NONE);
  const report: WearReport = {
    region: point.sido,
    point: point.name,
    temp: facts.temp,
    low: facts.low,
    high: facts.high,
    pop: facts.pop,
    hours: facts.hours,
    date: kstDateKey(),
  };
  memory.set(cacheKey, { at: Date.now(), report });
  return bunJson({ ok: true, report }, 200, CACHE);
}
