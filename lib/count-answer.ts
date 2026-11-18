import { sql } from '@/lib/db';
import { logDb } from '@/lib/http';

export async function ensureCountAnswer(key: string, answer: number): Promise<void> {
  if (!sql || answer < 1) return;
  try {
    await sql`select public.bun_set_count_answer(${key}::date, ${answer}::int)`;
  } catch (err) {
    logDb(err);
  }
}
