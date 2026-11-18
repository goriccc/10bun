import { sql } from '@/lib/db';
import { badRequest, bunJson, disabled, logDb, readBody } from '@/lib/http';
import { withPlayer } from '@/lib/room-write';
import { regions } from '@/content/regions';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await readBody(req)) as { device?: unknown; nickname?: unknown; region?: unknown };
  if (typeof body.device !== 'string' || typeof body.nickname !== 'string' || typeof body.region !== 'string') return badRequest();
  const device = body.device;
  const nickname = body.nickname;
  const region = body.region;
  if (!(regions as readonly string[]).includes(region)) return badRequest();
  if (!sql) return disabled();
  try {
    const result = await withPlayer(device, nickname, region, async () => {
      const rows = await sql!`select public.bun_feed_fish(${device}::uuid, ${region}) as r`;
      const row = rows[0]?.r;
      return row && typeof row === 'object' ? (row as { ok?: boolean; code?: string }) : { ok: false, code: 'bad_request' };
    });
    return bunJson(result);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
