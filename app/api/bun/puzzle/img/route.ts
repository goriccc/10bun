import { kstDateKey } from '@/lib/daily';
import { fetchPuzzleObject, storageConfig, todayPuzzleFile } from '@/lib/puzzle-image';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get('d') || kstDateKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response('bad date', { status: 400 });
    }

    if (!storageConfig()) {
      console.error('puzzle img: BUN_SUPABASE_URL or BUN_SUPABASE_SERVICE_KEY missing');
      return new Response('storage unset', { status: 503 });
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

    // Vercel에서 upstream body 스트림을 그대로 넘기면 빈 500이 날 수 있어 버퍼로 반환한다.
    const type = object.headers.get('content-type') || 'image/webp';
    const bytes = Buffer.from(await object.arrayBuffer());
    if (!bytes.byteLength) return new Response('empty', { status: 502 });

    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': type,
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (err) {
    console.error('puzzle img failed', err);
    return new Response('error', { status: 500 });
  }
}
