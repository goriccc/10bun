import { sql } from '@/lib/db';
import { bunJson, disabled, logDb } from '@/lib/http';

export const runtime = 'nodejs';

const CACHE = 'private, no-store';

function deviceOf(req: Request): string | null {
  const device = req.headers.get('x-bun-device');
  if (!device || !/^[0-9a-f-]{36}$/i.test(device)) return null;
  return device;
}

export async function GET(req: Request) {
  if (!sql) return disabled(CACHE);
  const device = deviceOf(req);
  try {
    const rows = device
      ? await sql`select public.bun_get_fish(${device}::uuid) as r`
      : await sql`select public.bun_get_fish(null::uuid) as r`;
    const row = rows[0]?.r;
    return bunJson(row && typeof row === 'object' ? row : { ok: false, code: 'bad_request' }, 200, CACHE);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
