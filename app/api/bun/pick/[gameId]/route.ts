import { sql } from '@/lib/db';
import { badRequest, bunJson, disabled, logDb } from '@/lib/http';
import { fillForecastRefs } from '@/lib/games/forecast-ref';

export const runtime = 'nodejs';

const CACHE_PICK = 'private, max-age=10';

function deviceOf(req: Request): string | null {
  const device = req.headers.get('x-bun-device');
  if (!device || !/^[0-9a-f-]{36}$/i.test(device)) return null;
  return device;
}

export async function GET(req: Request, ctx: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await ctx.params;
  const id = Number(gameId);
  if (![11, 12, 13, 16].includes(id)) return badRequest();
  if (!sql) return disabled(CACHE_PICK);
  // 기온 채우기는 요청을 막지 않는다 (백그라운드).
  if (id === 16) void fillForecastRefs();
  const device = deviceOf(req);
  try {
    const rows = device
      ? await sql`select public.bun_get_pick(${device}::uuid, ${id}::smallint) as r`
      : await sql`select public.bun_get_pick(null::uuid, ${id}::smallint) as r`;
    const row = rows[0]?.r;
    return bunJson(row && typeof row === 'object' ? row : { ok: false, code: 'bad_request' }, 200, CACHE_PICK);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
