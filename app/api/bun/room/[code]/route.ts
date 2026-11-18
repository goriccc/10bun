import { sql } from '@/lib/db';
import { CACHE_ROOM, badRequest, bunJson, disabled, logDb } from '@/lib/http';
import { asRoomResult } from '@/lib/room-write';
import { roomCodeOk } from '@/lib/rooms';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const roomCode = code.trim().toUpperCase();
  if (!roomCodeOk(roomCode)) return badRequest();
  if (!sql) return disabled(CACHE_ROOM);
  try {
    const rows = await sql`select public.bun_get_room(${roomCode}, null::uuid) as r`;
    return bunJson(asRoomResult(rows[0]?.r), 200, CACHE_ROOM);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
