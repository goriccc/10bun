import { LUNCH_MENUS } from '@/content/lunch';
import { regions } from '@/content/regions';
import { sql } from '@/lib/db';
import { kstDateKey } from '@/lib/daily';
import { CACHE_ROOM, badRequest, bunJson, disabled, logDb, readBody } from '@/lib/http';
import { anonKey, readSalt } from '@/lib/phase3';

export const runtime = 'nodejs';

const menus = new Set(Object.values(LUNCH_MENUS).flat());

export async function GET() {
  if (!sql) return disabled(CACHE_ROOM);
  try {
    const rows = await sql`select public.bun_lunch_board() as r`;
    const row = rows[0]?.r;
    return bunJson(row && typeof row === 'object' ? row : { ok: false, code: 'bad_request' }, 200, CACHE_ROOM);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}

export async function POST(req: Request) {
  const body = (await readBody(req)) as { device?: unknown; region?: unknown; menu?: unknown };
  if (typeof body.device !== 'string' || typeof body.region !== 'string' || typeof body.menu !== 'string') return badRequest();
  if (!(regions as readonly string[]).includes(body.region) || !menus.has(body.menu)) return badRequest();
  if (!sql) return disabled();
  const salt = readSalt();
  if (!salt) return disabled();
  try {
    const rows = await sql`select public.bun_lunch_tap(${anonKey(body.device, salt, kstDateKey())}, ${body.menu}, ${body.region}) as r`;
    const row = rows[0]?.r;
    return bunJson(row && typeof row === 'object' ? row : { ok: false, code: 'bad_request' });
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
