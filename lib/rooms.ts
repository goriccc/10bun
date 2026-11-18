import { siteUrl } from '@/content/site';
import { kstDateKey } from '@/lib/daily';

export const roomGameIds = [1, 2, 3, 4, 5, 6] as const;

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function roomCodeOk(code: string): boolean {
  return new RegExp(`^[${ROOM_ALPHABET}]{8}$`).test(code);
}

export function daysLeft(expiresAt: string, now = Date.now()): number {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export function roomLink(code: string, medium: 'native' | 'copy' = 'copy', key = kstDateKey()): string {
  const url = new URL(`${siteUrl().replace(/\/$/, '')}/r/${code}`);
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', 'room');
  url.searchParams.set('utm_content', key.replaceAll('-', ''));
  return url.toString();
}

export function roomInvite(name: string, gameTitle: string, code: string): string {
  return `[10분닷컴 대결방] ${name}\n${gameTitle}로 7일 대결\n${roomLink(code)}`;
}
