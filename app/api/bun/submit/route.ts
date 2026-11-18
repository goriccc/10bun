import { sql } from '@/lib/db';
import { kstDateKey } from '@/lib/daily';
import { elapsedOk } from '@/lib/games/puzzle';
import { verifyScore } from '@/lib/games/verify';
import { badRequest, bunJson, disabled, logDb, metaBytes, readBody } from '@/lib/http';
import { submitSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const parsed = submitSchema.safeParse(await readBody(req));
  if (!parsed.success) return badRequest();
  const { attemptId, device, gameId, score, elapsed, meta } = parsed.data;
  const size = metaBytes(meta);
  if (size == null || size > 4096) return badRequest();
  const serverDate = kstDateKey();
  const checked = verifyScore(gameId, serverDate, score, meta);
  if (!checked.ok) return bunJson({ ok: false, code: 'verify_failed' });
  if (gameId === 15) {
    const solveMs = meta && typeof meta === 'object' ? (meta as { solveMs?: unknown }).solveMs : null;
    if (typeof solveMs !== 'number' || !elapsedOk(elapsed, solveMs)) {
      return bunJson({ ok: false, code: 'verify_failed' });
    }
  }
  if (!sql) return disabled();
  try {
    const rows = await sql`select public.bun_submit_score(${attemptId}::bigint, ${device}::uuid, ${checked.score}::numeric, ${elapsed}::numeric, ${sql.json(meta as postgresJson)}::jsonb) as r`;
    return bunJson(rows[0]?.r ?? { ok: false, code: 'bad_request' });
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request' }, 500);
  }
}

type postgresJson = Parameters<NonNullable<typeof sql>['json']>[0];
