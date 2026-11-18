import { NextResponse } from 'next/server';

export const CACHE_BOARD = 'public, max-age=60, s-maxage=60, stale-while-revalidate=30';
export const CACHE_ROOM = 'public, max-age=10, s-maxage=10, stale-while-revalidate=10';
export const CACHE_NONE = 'no-store';

export function bunJson(body: unknown, status = 200, cache?: string) {
  const headers = new Headers();
  if (cache) headers.set('Cache-Control', cache);
  return NextResponse.json(body, { status, headers });
}

export function badRequest() {
  return bunJson({ ok: false, code: 'bad_request' }, 400);
}

export function disabled(cache?: string) {
  return bunJson({ ok: false, code: 'disabled' }, 200, cache);
}

export async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function logDb(err: unknown) {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : 'error';
  console.error('bun query failed', code);
}

export function metaBytes(meta: unknown): number | null {
  try {
    const encoded = JSON.stringify(meta ?? null);
    if (typeof encoded !== 'string') return null;
    return Buffer.byteLength(encoded);
  } catch {
    return null;
  }
}
