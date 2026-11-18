import { sql } from '@/lib/db';
import { badRequest, bunJson, disabled, logDb, readBody } from '@/lib/http';
import { asRoomResult, withPlayer } from '@/lib/room-write';
import { joinRoomSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const parsed = joinRoomSchema.safeParse(await readBody(req));
  if (!parsed.success) return badRequest();
  if (!sql) return disabled();
  const { device, nickname, region, code } = parsed.data;
  try {
    const result = await withPlayer(device, nickname, region, async () => {
      const rows = await sql!`select public.bun_join_room(${device}::uuid, ${code.trim()}) as r`;
      return asRoomResult(rows[0]?.r);
    });
    return bunJson(result);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
