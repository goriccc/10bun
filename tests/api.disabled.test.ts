import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ sql: null }));

import { GET as champions } from '@/app/api/bun/champions/route';
import { POST as start } from '@/app/api/bun/start/route';

describe('db가 없으면', () => {
  it('순위 API는 disabled와 캐시 헤더를 준다', async () => {
    const res = await champions();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=30');
    expect(await res.json()).toEqual({ ok: false, code: 'disabled' });
  });

  it('시작도 disabled', async () => {
    const res = await start(
      new Request('http://local/api/bun/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId: 1, device: crypto.randomUUID(), nickname: '흐름일', region: '서울' }),
      }),
    );
    expect(await res.json()).toEqual({ ok: false, code: 'disabled' });
  });
});
