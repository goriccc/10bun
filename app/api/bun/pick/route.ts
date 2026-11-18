import { sql } from '@/lib/db';
import { kstDateKey } from '@/lib/daily';
import { CACHE_NONE, badRequest, bunJson, disabled, logDb, readBody } from '@/lib/http';
import { clientIpKey, ipHash } from '@/lib/ip';
import { readSalt } from '@/lib/phase3';
import { phaseMessage } from '@/lib/phase3-message';
import { withPlayer } from '@/lib/room-write';
import { regions } from '@/content/regions';

export const runtime = 'nodejs';

type PickBody = {
  device?: unknown;
  nickname?: unknown;
  region?: unknown;
  gameId?: unknown;
  value?: unknown;
};

type postgresJson = Parameters<NonNullable<typeof sql>['json']>[0];

function valueOk(gameId: number, value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (gameId === 11) return Number.isInteger(row.guess) && Number(row.guess) >= 1 && Number(row.guess) <= 5000;
  if (gameId === 12) {
    return Array.isArray(row.choices) && row.choices.length === 3 && row.choices.every((item) => Number.isInteger(item) && Number(item) >= 0 && Number(item) <= 3);
  }
  if (gameId === 13) return Number.isInteger(row.n) && Number(row.n) >= 1 && Number(row.n) <= 100;
  if (gameId === 16) {
    const guess = Number(row.guess);
    return typeof row.region === 'string' && (regions as readonly string[]).includes(row.region) && Number.isFinite(guess) && guess >= -15 && guess <= 40;
  }
  return false;
}

export async function POST(req: Request) {
  const body = (await readBody(req)) as PickBody;
  const gameId = body.gameId;
  const device = body.device;
  const nickname = body.nickname;
  const region = body.region;
  if (typeof gameId !== 'number' || typeof device !== 'string' || typeof nickname !== 'string' || typeof region !== 'string') return badRequest();
  if (![11, 12, 13, 16].includes(gameId) || !valueOk(gameId, body.value)) return badRequest();
  if (!sql) return disabled();
  const salt = readSalt();
  if (!salt) return disabled();
  const hash = ipHash(clientIpKey(req.headers), salt, kstDateKey());
  try {
    const result = await withPlayer(device, nickname, region, async () => {
      const rows = await sql!`select public.bun_put_pick(${device}::uuid, ${gameId}::smallint, ${sql!.json(body.value as postgresJson)}, ${hash}) as r`;
      const row = rows[0]?.r;
      return row && typeof row === 'object' ? (row as { ok?: boolean; code?: string }) : { ok: false, code: 'bad_request' };
    });
    return bunJson(result, 200, CACHE_NONE);
  } catch (err) {
    logDb(err);
    return bunJson({ ok: false, code: 'bad_request', message: phaseMessage('bad_request') }, 500);
  }
}

