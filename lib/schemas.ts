import { z } from 'zod';

const gameId = z.number().int().min(1).max(32767);
const device = z.string().uuid();

export const profileSchema = z.object({
  device,
  nickname: z.string().max(80),
  region: z.string().max(40),
});

export const startSchema = profileSchema.extend({
  gameId,
});

export const submitSchema = z.object({
  attemptId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  device,
  gameId,
  score: z.number().finite(),
  elapsed: z.number().finite(),
  meta: z.unknown(),
});

export const createRoomSchema = z.object({
  device,
  nickname: z.string().max(80),
  region: z.string().max(40),
  name: z.string().max(40),
  gameId: z.number().int().min(1).max(6),
});

export const joinRoomSchema = z.object({
  device,
  nickname: z.string().max(80),
  region: z.string().max(40),
  code: z.string().max(16),
});

export function gameIdParam(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  if (id < 1 || id > 32767) return null;
  return id;
}
