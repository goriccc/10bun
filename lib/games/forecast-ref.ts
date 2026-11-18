import { wearDefault } from '@/content/wear-points';
import { kstDateKey, kstHour } from '@/lib/daily';
import { sql } from '@/lib/db';
import { logDb } from '@/lib/http';
import { forecastBases, villageUrl, type FcstItem } from '@/lib/games/wear';

const memory = new Map<string, number>();

export function highOn(items: FcstItem[], dateKey: string): number | null {
  const compact = dateKey.replaceAll('-', '');
  const tmx = items.find((item) => item.category === 'TMX' && item.fcstDate === compact);
  if (tmx && Number.isFinite(Number(tmx.fcstValue))) return Number(tmx.fcstValue);
  const temps = items
    .filter((item) => item.category === 'TMP' && item.fcstDate === compact)
    .map((item) => Number(item.fcstValue))
    .filter((value) => Number.isFinite(value));
  if (temps.length === 0) return null;
  return Math.max(...temps);
}

function itemsOf(body: unknown): FcstItem[] {
  const response = body && typeof body === 'object' ? (body as { response?: { header?: { resultCode?: string }; body?: { items?: { item?: FcstItem | FcstItem[] } } } }).response : undefined;
  if (response?.header?.resultCode !== '00') return [];
  const item = response.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

async function loadHigh(nx: number, ny: number, key: string, dateKey: string): Promise<number | null> {
  for (const base of forecastBases()) {
    const url = villageUrl(key, { base_date: base.date, base_time: base.time, nx: String(nx), ny: String(ny) });
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('{')) continue;
      const high = highOn(itemsOf(JSON.parse(text) as unknown), dateKey);
      if (high != null) return high;
    } catch {
      continue;
    }
  }
  return null;
}

/** 어제 예측의 비교값. 저녁 6시 이후, 기상청 단기예보 최고기온만 넣는다. */
export async function fillForecastRefs(now = new Date()): Promise<void> {
  if (!sql || kstHour(now) < 18) return;
  const key = process.env.KMA_SERVICE_KEY;
  if (!key) return;
  const target = kstDateKey(now);
  const at = memory.get(target);
  if (at && now.getTime() - at < 10 * 60 * 1000) return;
  memory.set(target, now.getTime());
  try {
    const db = sql;
    const rows = await db`select public.bun_forecast_gaps(${target}::date) as r`;
    const gaps = rows[0]?.r;
    const regions = Array.isArray(gaps) ? gaps.filter((item): item is string => typeof item === 'string') : [];
    const jobs: { region: string; nx: number; ny: number }[] = [];
    for (const region of regions) {
      const point = wearDefault(region);
      if (!point) continue;
      jobs.push({ region, nx: point.nx, ny: point.ny });
    }
    // 지역별 KMA를 최대 3개씩 병렬로.
    for (let i = 0; i < jobs.length; i += 3) {
      const chunk = jobs.slice(i, i + 3);
      await Promise.all(
        chunk.map(async ({ region, nx, ny }) => {
          const high = await loadHigh(nx, ny, key, target);
          if (high == null) return;
          await db`select public.bun_set_forecast_ref(${target}::date, ${region}, ${high})`;
        }),
      );
    }
  } catch (err) {
    memory.delete(target);
    logDb(err);
  }
}
