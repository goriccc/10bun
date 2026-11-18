import { afterAll, describe, expect, it } from 'vitest';
import { GET as board } from '@/app/api/bun/board/[gameId]/route';
import { GET as me } from '@/app/api/bun/me/[gameId]/route';
import { POST as start } from '@/app/api/bun/start/route';
import { POST as submit } from '@/app/api/bun/submit/route';
import { sql } from '@/lib/db';
import { kstDateKey } from '@/lib/daily';
import { round3, targetSeconds } from '@/lib/games/10sec';

function devUrl(): boolean {
  const url = process.env.BUN_DATABASE_URL;
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.username).split('.')[0] === 'bun_app';
  } catch {
    return false;
  }
}

describe.skipIf(!devUrl())('개발 DB 시작 제출 순위', () => {
  afterAll(async () => {
    await sql?.end({ timeout: 1 });
  });

  it('공식 도전을 내고 내 순위와 순위표에서 찾는다', async () => {
    const device = crypto.randomUUID();
    const nickname = '흐름일';
    const startedRes = await start(
      new Request('http://127.0.0.1/api/bun/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.40' },
        body: JSON.stringify({ gameId: 1, device, nickname, region: '서울' }),
      }),
    );
    const started = await startedRes.json();
    expect(started.ok).toBe(true);

    const target = targetSeconds(kstDateKey());
    const gameElapsed = round3(target + 0.25);
    const score = round3(Math.abs(gameElapsed - target));
    const submittedRes = await submit(
      new Request('http://127.0.0.1/api/bun/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          attemptId: Number(started.attempt_id),
          device,
          gameId: 1,
          score,
          elapsed: 0.5,
          meta: { gameElapsed },
        }),
      }),
    );
    const submitted = await submittedRes.json();
    expect(submitted.ok).toBe(true);
    expect(submitted.status).toBe('ranked');

    const meRes = await me(new Request('http://127.0.0.1/api/bun/me/1', { headers: { 'x-bun-device': device } }), {
      params: Promise.resolve({ gameId: '1' }),
    });
    const mine = await meRes.json();
    expect(mine.has_record).toBe(true);
    expect(mine.rank).toBeGreaterThanOrEqual(1);
    expect(mine.nickname).toBe(nickname);
    expect(JSON.stringify(mine)).not.toContain(device);

    const boardRes = await board(new Request('http://127.0.0.1/api/bun/board/1'), {
      params: Promise.resolve({ gameId: '1' }),
    });
    expect(boardRes.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=30');
    const body = await boardRes.json();
    expect(body.enabled).toBe(true);
    expect(body.play_date).toBe(kstDateKey());
  }, 20000);
});
