import { sql } from '@/lib/db';
import { kstDateKey } from '@/lib/daily';
import { sizeFor } from '@/lib/games/puzzle';
import { badRequest, bunJson, disabled, logDb, readBody } from '@/lib/http';
import { clientIpKey, ipHash } from '@/lib/ip';
import { todayPuzzleImage } from '@/lib/puzzle-image';
import { startSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const parsed = startSchema.safeParse(await readBody(req));
  if (!parsed.success) return badRequest();
  if (!sql) return disabled();
  const salt = process.env.BUN_IP_SALT;
  if (!salt || salt.length < 32) {
    console.error('BUN_IP_SALT missing');
    return disabled();
  }
  const { gameId, device, nickname, region } = parsed.data;
  const date = kstDateKey();
  const hash = ipHash(clientIpKey(req.headers), salt, date);
  try {
    const rows = await sql`select public.bun_start_attempt(${gameId}::smallint, ${device}::uuid, ${hash}, ${nickname.trim()}, ${region}) as r`;
    const result = (rows[0]?.r ?? { ok: false, code: 'bad_request' }) as Record<string, unknown>;
    if (gameId === 15) {
      // 시작 실패(연습)여도 미리보기용 그림은 내려 준다. 순위 제출은 ok일 때만 된다.
      const image = await todayPuzzleImage(date);
      return bunJson({ ...result, puzzle: { size: sizeFor(date), image } });
    }
    return bunJson(result);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}
