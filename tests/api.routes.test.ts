import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kstDateKey } from '@/lib/daily';
import { round3, targetSeconds } from '@/lib/games/10sec';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('@/lib/db', () => {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => query(strings.join('?'), values);
  sql.json = (value: unknown) => value;
  return { sql };
});

import { GET as board } from '@/app/api/bun/board/[gameId]/route';
import { GET as me } from '@/app/api/bun/me/[gameId]/route';
import { POST as profile } from '@/app/api/bun/profile/route';
import { POST as start } from '@/app/api/bun/start/route';
import { POST as submit } from '@/app/api/bun/submit/route';

const SALT = '0123456789abcdef0123456789abcdef';

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue([{ r: { ok: true, enabled: true } }]);
  process.env.BUN_IP_SALT = SALT;
});

function jsonRequest(url: string, body: unknown, headers?: HeadersInit) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('api routes', () => {
  it('순위표는 캐시 헤더와 함께 함수 결과를 그대로 준다', async () => {
    query.mockResolvedValueOnce([{ r: { enabled: true, participants: 0, top: [] } }]);
    const res = await board(new Request('http://local/api/bun/board/1'), { params: Promise.resolve({ gameId: '1' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=30');
    expect(await res.json()).toEqual({ enabled: true, participants: 0, top: [] });
  });

  it('잘못된 게임 번호는 400', async () => {
    const res = await board(new Request('http://local/api/bun/board/nope'), { params: Promise.resolve({ gameId: 'nope' }) });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('내 순위는 기기 ID를 헤더로만 받는다', async () => {
    const missing = await me(new Request('http://local/api/bun/me/1'), { params: Promise.resolve({ gameId: '1' }) });
    expect(missing.status).toBe(400);
    const device = crypto.randomUUID();
    const res = await me(new Request('http://local/api/bun/me/1', { headers: { 'x-bun-device': device } }), {
      params: Promise.resolve({ gameId: '1' }),
    });
    expect(res.headers.get('cache-control')).toBe('no-store');
    const values = query.mock.calls[0][1] as unknown[];
    expect(values).toContain(device);
  });

  it('솔트가 없으면 시작하지 않는다', async () => {
    delete process.env.BUN_IP_SALT;
    const res = await start(
      jsonRequest('http://local/api/bun/start', { gameId: 1, device: crypto.randomUUID(), nickname: '흐름일', region: '서울' }),
    );
    expect(await res.json()).toEqual({ ok: false, code: 'disabled' });
    expect(query).not.toHaveBeenCalled();
  });

  it('시작은 IP 원문 대신 해시를 넘긴다', async () => {
    const device = crypto.randomUUID();
    const res = await start(
      jsonRequest(
        'http://local/api/bun/start',
        { gameId: 1, device, nickname: ' 흐름일 ', region: '서울' },
        { 'x-forwarded-for': '203.0.113.9' },
      ),
    );
    expect(res.status).toBe(200);
    const values = query.mock.calls[0][1] as unknown[];
    expect(values).not.toContain('203.0.113.9');
    expect(values).toContain('흐름일');
    expect(values.some((v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v))).toBe(true);
  });

  it('검증에 실패하면 DB를 부르지 않는다', async () => {
    const res = await submit(
      jsonRequest('http://local/api/bun/submit', {
        attemptId: 1,
        device: crypto.randomUUID(),
        gameId: 2,
        score: 10,
        elapsed: 3,
        meta: { picks: [] },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, code: 'verify_failed' });
    expect(query).not.toHaveBeenCalled();
  });

  it('메타가 4KB를 넘으면 400', async () => {
    const res = await submit(
      jsonRequest('http://local/api/bun/submit', {
        attemptId: 1,
        device: crypto.randomUUID(),
        gameId: 1,
        score: 1,
        elapsed: 2,
        meta: { blob: '가'.repeat(3000) },
      }),
    );
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('10초 제출은 서버가 다시 계산한 점수를 넘긴다', async () => {
    const target = targetSeconds(kstDateKey());
    const gameElapsed = round3(target + 0.2);
    const score = round3(Math.abs(gameElapsed - target));
    query.mockResolvedValueOnce([{ r: { ok: true, status: 'ranked', score } }]);
    const res = await submit(
      jsonRequest('http://local/api/bun/submit', {
        attemptId: 7,
        device: crypto.randomUUID(),
        gameId: 1,
        score,
        elapsed: 2,
        meta: { gameElapsed },
      }),
    );
    expect((await res.json()).status).toBe('ranked');
    const values = query.mock.calls[0][1] as unknown[];
    expect(values).toContain(score);
  });

  it('별명 앞뒤 공백을 지우고 저장한다', async () => {
    await profile(jsonRequest('http://local/api/bun/profile', { device: crypto.randomUUID(), nickname: ' 조용한 ', region: '미정' }));
    const values = query.mock.calls[0][1] as unknown[];
    expect(values).toContain('조용한');
  });
});
