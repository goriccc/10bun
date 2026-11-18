import { sql } from '@/lib/db';
import { bunJson, disabled, logDb } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST() {
  if (!sql) return disabled();
  try {
    const rows = await sql`select public.bun_hatch_fish() as r`;
    const row = rows[0]?.r;
    return bunJson(row && typeof row === 'object' ? row : { ok: false, code: 'bad_request' });
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
