import { kstDateKey } from './daily';
import { siteUrl } from '@/content/site';

export function dateShort(key = kstDateKey()): string {
  const [, month, day] = key.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export type ShareMedium = 'native' | 'copy' | 'text' | 'x' | 'facebook' | 'image';

export function shareLink(slug: string, medium: ShareMedium, key = kstDateKey(), kind: 'invite' | 'result' = 'invite'): string {
  const url = new URL(`${siteUrl().replace(/\/$/, '')}/${slug}`);
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', slug);
  url.searchParams.set('utm_content', key.replaceAll('-', ''));
  url.searchParams.set('utm_term', kind);
  return url.toString();
}

export function rankLine(rank: number, participants: number): string {
  return `전국 ${rank.toLocaleString('ko-KR')}위 / ${participants.toLocaleString('ko-KR')}명`;
}
