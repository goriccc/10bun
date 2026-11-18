import { kstDateKey } from '@/lib/daily';
import { fetchPuzzleObject, todayPuzzleFile } from '@/lib/puzzle-image';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get('d') || kstDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response('bad date', { status: 400 });
  }

  const today = kstDateKey();
  let file: string | null = null;

  if (date === today) {
    file = await todayPuzzleFile(date);
  } else if (date < today && sql) {
    try {
      const rows = await sql`select public.bun_puzzle_get(${date}::date) as file_name`;
      file = typeof rows[0]?.file_name === 'string' ? rows[0].file_name : null;
    } catch {
      file = null;
    }
  }

  if (!file) return new Response('not found', { status: 404 });

  const object = await fetchPuzzleObject(file);
  if (!object) return new Response('unavailable', { status: 502 });

  const type = object.headers.get('content-type') || 'image/webp';
  return new Response(object.body, {
    status: 200,
    headers: {
      'content-type': type,
      'cache-control': 'private, max-age=300',
    },
  });
}
