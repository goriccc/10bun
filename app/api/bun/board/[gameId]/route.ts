import { sql } from '@/lib/db';
import { CACHE_BOARD, badRequest, bunJson, disabled, logDb } from '@/lib/http';
import { gameIdParam } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await ctx.params;
  const id = gameIdParam(gameId);
  if (id == null) return badRequest();
  if (!sql) return disabled(CACHE_BOARD);
  try {
    const rows = await sql`select public.bun_get_board(${id}::smallint) as r`;
    return bunJson(rows[0]?.r ?? { ok: false, code: 'bad_request' }, 200, CACHE_BOARD);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
