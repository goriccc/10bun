import { sql } from '@/lib/db';
import { badRequest, bunJson, disabled, logDb, readBody } from '@/lib/http';
import { profileSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const parsed = profileSchema.safeParse(await readBody(req));
  if (!parsed.success) return badRequest();
  if (!sql) return disabled();
  const { device, nickname, region } = parsed.data;
  try {
    const rows = await sql`select public.bun_set_profile(${device}::uuid, ${nickname.trim()}, ${region}) as r`;
    return bunJson(rows[0]?.r ?? { ok: false, code: 'bad_request' });
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
