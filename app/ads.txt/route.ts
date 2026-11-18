import { adsTxtLine } from '@/lib/ads';

export const runtime = 'nodejs';

export function GET() {
  const line = adsTxtLine(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
  if (!line) return new Response('not configured\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(line, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
