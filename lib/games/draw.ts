import { DRAW_WORDS } from '@/content/draw-words';
import { siteUrl } from '@/content/site';
import { daily, dateFromKey, kstDateKey } from '@/lib/daily';
import type { Pt } from './shape';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function todayWord(key = kstDateKey()): string {
  const index = Math.floor(daily(10, dateFromKey(key))() * DRAW_WORDS.length);
  return DRAW_WORDS[index] ?? DRAW_WORDS[0];
}

export function encodeStrokes(strokes: Pt[][]): string {
  const bytes: number[] = [];
  for (const stroke of strokes.slice(0, 12)) {
    bytes.push(255);
    const slim = stroke.filter((_, index) => index % 2 === 0).slice(0, 80);
    for (const [x, y] of slim) {
      bytes.push(Math.round(Math.min(1, Math.max(0, x)) * 254), Math.round(Math.min(1, Math.max(0, y)) * 254));
    }
  }
  return bytesToUrl(bytes);
}

export function decodeStrokes(code: string): Pt[][] {
  const bytes = urlToBytes(code);
  const strokes: Pt[][] = [];
  let current: Pt[] | null = null;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 255) {
      current = [];
      strokes.push(current);
      continue;
    }
    if (!current || i + 1 >= bytes.length) break;
    current.push([bytes[i] / 254, bytes[i + 1] / 254]);
    i += 1;
  }
  return strokes.filter((stroke) => stroke.length > 0);
}

export function drawHref(key: string, code: string, medium: 'native' | 'copy'): string {
  const url = new URL(`${siteUrl().replace(/\/$/, '')}/draw`);
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', 'draw');
  url.searchParams.set('utm_content', key.replaceAll('-', ''));
  url.hash = `v1.${key.replaceAll('-', '')}.${code}`;
  return url.toString();
}

export function readDrawHash(hash: string): { key: string; strokes: Pt[][] } | null {
  const match = hash.replace(/^#/, '').match(/^v1\.(\d{8})\.([A-Za-z0-9_-]+)$/);
  if (!match) return null;
  const compact = match[1];
  const key = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  const strokes = decodeStrokes(match[2]);
  if (strokes.length === 0) return null;
  return { key, strokes };
}

function bytesToUrl(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const value = (b0 << 16) | (b1 << 8) | b2;
    out += ALPHA[(value >> 18) & 63] + ALPHA[(value >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHA[(value >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHA[value & 63];
  }
  return out;
}

function urlToBytes(code: string): number[] {
  const clean = code.replace(/-/g, '-').replace(/_/g, '_');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((offset) => ALPHA.indexOf(clean[i + offset] ?? 'A'));
    if (n[0] < 0 || n[1] < 0) break;
    const value = (n[0] << 18) | (n[1] << 12) | ((n[2] < 0 ? 0 : n[2]) << 6) | (n[3] < 0 ? 0 : n[3]);
    bytes.push((value >> 16) & 255);
    if (i + 2 < clean.length) bytes.push((value >> 8) & 255);
    if (i + 3 < clean.length) bytes.push(value & 255);
  }
  return bytes;
}
