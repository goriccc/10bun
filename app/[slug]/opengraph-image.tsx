import { ImageResponse } from 'next/og';
import { serviceBySlug } from '@/content/services';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#E6E3F1', color: '#231D4B' }}>
      <div style={{ fontSize: 36 }}>10분닷컴</div>
      <div style={{ fontSize: 80, marginTop: 12 }}>{service?.title ?? '오늘의 10분'}</div>
    </div>,
    size,
  );
}
