import { sql } from '@/lib/db';
import { logDb } from '@/lib/http';

export type FishBoard = {
  ok?: boolean;
  code?: string;
  fish?: {
    generation?: number;
    fullness?: number;
    born_at?: string;
    died_at?: string | null;
    alive?: boolean;
    reason?: string | null;
    region?: string | null;
    feeders?: number;
  };
  left?: number;
  recent?: { region?: string; at?: string }[];
  past?: { generation?: number; born_at?: string; died_at?: string; reason?: string; region?: string | null; feeders?: number }[];
};

export async function readFishBoard(): Promise<FishBoard | null> {
  if (!sql) return null;
  try {
    const rows = await sql`select public.bun_get_fish(null::uuid) as r`;
    const row = rows[0]?.r;
    if (!row || typeof row !== 'object') return null;
    const board = row as FishBoard;
    delete board.left;
    return board;
  } catch (err) {
    logDb(err);
    return null;
  }
}
