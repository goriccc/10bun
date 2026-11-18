import { regions } from '@/content/regions';
import { sql } from '@/lib/db';
import { kstDateKey } from '@/lib/daily';
import { CACHE_ROOM, badRequest, bunJson, disabled, logDb, readBody } from '@/lib/http';
import { anonKey, readSalt } from '@/lib/phase3';

export const runtime = 'nodejs';

export async function GET() {
  if (!sql) return disabled(CACHE_ROOM);
  try {
    const rows = await sql`select public.bun_offwork_board() as r`;
    const row = rows[0]?.r;
    return bunJson(row && typeof row === 'object' ? row : { ok: false, code: 'bad_request' }, 200, CACHE_ROOM);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}

export async function POST(req: Request) {
  const body = (await readBody(req)) as { device?: unknown; region?: unknown };
  if (typeof body.device !== 'string' || typeof body.region !== 'string') return badRequest();
  if (!(regions as readonly string[]).includes(body.region)) return badRequest();
  if (!sql) return disabled();
  const salt = readSalt();
  if (!salt) return disabled();
  try {
    const rows = await sql`select public.bun_offwork_tap(${anonKey(body.device, salt, kstDateKey())}, ${body.region}) as r`;
    const row = rows[0]?.r;
    return bunJson(row && typeof row === 'object' ? row : { ok: false, code: 'bad_request' });
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
