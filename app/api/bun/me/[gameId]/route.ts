import { z } from 'zod';
import { sql } from '@/lib/db';
import { CACHE_NONE, badRequest, bunJson, disabled, logDb } from '@/lib/http';
import { gameIdParam } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await ctx.params;
  const id = gameIdParam(gameId);
  const device = req.headers.get('x-bun-device') ?? '';
  if (id == null || !z.string().uuid().safeParse(device).success) return badRequest();
  if (!sql) return disabled(CACHE_NONE);
  try {
    const rows = await sql`select public.bun_my_board(${id}::smallint, ${device}::uuid) as r`;
    return bunJson(rows[0]?.r ?? { ok: false, code: 'bad_request' }, 200, CACHE_NONE);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
