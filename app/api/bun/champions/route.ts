import { sql } from '@/lib/db';
import { CACHE_BOARD, bunJson, disabled, logDb } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET() {
  if (!sql) return disabled(CACHE_BOARD);
  try {
    const rows = await sql`select public.bun_get_champions() as r`;
    return bunJson(rows[0]?.r ?? { ok: false, code: 'bad_request' }, 200, CACHE_BOARD);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
