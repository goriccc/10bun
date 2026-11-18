export const siteName = '10분닷컴';
export const siteDescription = '매일 0시에 바뀌는 10분짜리 작은 즐거움.';

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://10bun.com';
}
