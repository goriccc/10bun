import { sharedJson } from '@/lib/client-fetch';

export type MePayload = Record<string, unknown> & {
  ok?: boolean;
  enabled?: boolean;
  blocked?: boolean;
  attempts_left?: number;
  nickname?: string;
  region?: string;
  has_record?: boolean;
  best?: number | string;
  rank?: number;
  participants?: number;
  pct?: number | null;
  week_points?: number;
  above?: unknown[];
  below?: unknown[];
};

export async function fetchMe(gameId: number, device: string): Promise<{ httpOk: boolean; body: MePayload }> {
  return sharedJson(`me:${gameId}:${device}`, async () => {
    const res = await fetch(`/api/bun/me/${gameId}`, { headers: { 'x-bun-device': device }, cache: 'no-store' });
    const body = (await res.json()) as MePayload;
    return { httpOk: res.ok, body };
  });
}
