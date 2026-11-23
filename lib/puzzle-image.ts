import { sql } from '@/lib/db';
import { kstDateKey } from '@/lib/daily';

const BUCKET = 'bun-puzzle';

type BucketFile = { name: string; created: string };

type FileCache = { date: string; file: string | null; at: number; list?: BucketFile[]; listAt?: number };

let fileCache: FileCache | null = null;
const FILE_TTL_MS = 5 * 60 * 1000;
const LIST_TTL_MS = 10 * 60 * 1000;

export function storageConfig(): { base: string; key: string } | null {
  const base = (process.env.BUN_SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.BUN_SUPABASE_SERVICE_KEY ?? '';
  if (!base || !key) return null;
  return { base, key };
}

async function listPuzzleFiles(): Promise<BucketFile[]> {
  const now = Date.now();
  if (fileCache?.list && fileCache.listAt && now - fileCache.listAt < LIST_TTL_MS) {
    return fileCache.list;
  }
  const cfg = storageConfig();
  if (!cfg) return [];
  const res = await fetch(`${cfg.base}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      apikey: cfg.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix: '',
      limit: 200,
      offset: 0,
      sortBy: { column: 'created_at', order: 'asc' },
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('puzzle: storage list failed', res.status);
    return fileCache?.list ?? [];
  }
  const body = (await res.json()) as Array<{ name?: string; created_at?: string; id?: string | null }>;
  if (!Array.isArray(body)) return fileCache?.list ?? [];
  const list = body
    .filter((item) => item && typeof item.name === 'string' && item.name && !item.name.endsWith('/') && item.id != null)
    .map((item) => ({ name: item.name!, created: item.created_at ?? '' }))
    .sort((a, b) => a.created.localeCompare(b.created) || a.name.localeCompare(b.name));
  fileCache = { ...(fileCache ?? { date: '', file: null, at: 0 }), list, listAt: now };
  return list;
}

function pickNextFile(files: BucketFile[], shown: Set<string>): string | null {
  if (!files.length) return null;
  const unseen = files.filter((file) => !shown.has(file.name));
  if (unseen.length) return unseen[0]!.name;
  return files[0]!.name;
}

function rememberFile(date: string, file: string | null) {
  fileCache = {
    date,
    file,
    at: Date.now(),
    list: fileCache?.list,
    listAt: fileCache?.listAt,
  };
}

/** 오늘 파일명 배정. DB 함수가 없어도 버킷 첫 파일로 진행. */
export async function todayPuzzleFile(date = kstDateKey()): Promise<string | null> {
  const now = Date.now();
  if (fileCache && fileCache.date === date && now - fileCache.at < FILE_TTL_MS) {
    return fileCache.file;
  }

  if (sql) {
    try {
      const existing = await sql`select public.bun_puzzle_get(${date}::date) as file_name`;
      const got = typeof existing[0]?.file_name === 'string' ? existing[0].file_name : null;
      if (got) {
        rememberFile(date, got);
        return got;
      }
    } catch (err) {
      console.error('puzzle: get failed', err);
    }
  }

  const files = await listPuzzleFiles();
  if (!files.length) {
    console.error('puzzle: no image scheduled', date);
    rememberFile(date, null);
    return null;
  }

  if (sql) {
    try {
      let shown = new Set<string>();
      try {
        const shownRows = await sql`select public.bun_puzzle_shown() as file_name`;
        shown = new Set(
          shownRows.map((row) => row.file_name).filter((name): name is string => typeof name === 'string' && name.length > 0),
        );
      } catch {
        shown = new Set();
      }

      const next = pickNextFile(files, shown);
      if (!next) {
        rememberFile(date, null);
        return null;
      }

      try {
        const assigned = await sql`select public.bun_puzzle_assign(${date}::date, ${next}) as file_name`;
        const name = typeof assigned[0]?.file_name === 'string' ? assigned[0].file_name : next;
        rememberFile(date, name);
        return name;
      } catch (err) {
        console.error('puzzle: assign failed', err);
        rememberFile(date, next);
        return next;
      }
    } catch (err) {
      console.error('puzzle: assign failed', err);
    }
  }

  const fallback = files[0]!.name;
  rememberFile(date, fallback);
  return fallback;
}

/** 클라이언트에 줄 주소. Storage를 직접 열지 않고 우리 API 프록시를 쓴다. */
export async function todayPuzzleImage(date = kstDateKey()): Promise<string | null> {
  const file = await todayPuzzleFile(date);
  if (!file) return null;
  return `/api/bun/puzzle/img?d=${encodeURIComponent(date)}`;
}

export async function fetchPuzzleObject(fileName: string): Promise<Response | null> {
  const cfg = storageConfig();
  if (!cfg || !fileName || fileName.includes('/') || fileName.includes('..')) return null;

  const headers = {
    Authorization: `Bearer ${cfg.key}`,
    apikey: cfg.key,
  };
  const encoded = encodeURIComponent(fileName);
  const paths = [
    `${cfg.base}/storage/v1/object/${BUCKET}/${encoded}`,
    `${cfg.base}/storage/v1/object/authenticated/${BUCKET}/${encoded}`,
    `${cfg.base}/storage/v1/object/public/${BUCKET}/${encoded}`,
  ];

  const statuses: number[] = [];
  for (const path of paths) {
    try {
      const res = await fetch(path, { headers, cache: 'no-store' });
      if (res.ok) return res;
      statuses.push(res.status);
    } catch (err) {
      console.error('puzzle: object path failed', path.split('/storage/')[1], err);
    }
  }

  try {
    const signed = await fetch(`${cfg.base}/storage/v1/object/sign/${BUCKET}/${encoded}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 120 }),
      cache: 'no-store',
    });
    if (!signed.ok) {
      console.error('puzzle: object fetch failed', statuses.join(','), 'sign', signed.status);
      return null;
    }
    const raw = await signed.text();
    let body: { signedURL?: string; signedUrl?: string } = {};
    try {
      body = JSON.parse(raw) as { signedURL?: string; signedUrl?: string };
    } catch {
      console.error('puzzle: sign json failed');
      return null;
    }
    const path = body.signedURL ?? body.signedUrl;
    if (!path) return null;
    const url = path.startsWith('http') ? path : `${cfg.base}/storage/v1${path.startsWith('/') ? path : `/${path}`}`;
    const fileRes = await fetch(url, { cache: 'no-store' });
    if (!fileRes.ok) {
      console.error('puzzle: signed fetch failed', fileRes.status);
      return null;
    }
    return fileRes;
  } catch (err) {
    console.error('puzzle: sign flow failed', err);
    return null;
  }
}

export async function pastPuzzleImages(before = kstDateKey()): Promise<{ date: string; image: string | null; file: string }[]> {
  if (!sql) return [];
  try {
    const rows = await sql`select * from public.bun_puzzle_past(${before}::date)`;
    const out: { date: string; image: string | null; file: string }[] = [];
    for (const row of rows) {
      const file = typeof row.file_name === 'string' ? row.file_name : '';
      const playDate = row.play_date instanceof Date ? row.play_date.toISOString().slice(0, 10) : String(row.play_date ?? '');
      if (!file || !playDate) continue;
      out.push({ date: playDate, file, image: `/api/bun/puzzle/img?d=${encodeURIComponent(playDate)}` });
    }
    return out;
  } catch {
    return [];
  }
}
