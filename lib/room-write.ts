import { sql } from '@/lib/db';

export type RoomResult = {
  ok?: boolean;
  code?: string;
  enabled?: boolean;
  joined_at?: string;
  expires_at?: string;
  room?: { code?: string; name?: string; game_id?: number; created_at?: string; expires_at?: string };
  rows?: unknown;
};

export function asRoomResult(value: unknown): RoomResult {
  if (value && typeof value === 'object') return value as RoomResult;
  return { ok: false, code: 'bad_request' };
}

/** 참여자 행이 없으면 프로필을 만든 뒤 한 번 더 시도한다. */
export async function withPlayer<T extends { ok?: boolean; code?: string }>(
  device: string,
  nickname: string,
  region: string,
  run: () => Promise<T>,
): Promise<T | RoomResult> {
  if (!sql) return { ok: false, code: 'disabled' };
  const first = await run();
  if (first.code !== 'no_player') return first;
  const rows = await sql`select public.bun_set_profile(${device}::uuid, ${nickname.trim()}, ${region}) as r`;
  const profile = asRoomResult(rows[0]?.r);
  if (!profile.ok && profile.code !== 'too_fast') return profile;
  return run();
}
