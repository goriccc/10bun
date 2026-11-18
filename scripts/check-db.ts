import { existsSync } from 'node:fs';
import postgres from 'postgres';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const url = process.env.BUN_DATABASE_URL;
if (!url) {
  console.error('BUN_DATABASE_URL missing');
  process.exit(1);
}

const parsed = new URL(url);
const role = decodeURIComponent(parsed.username).split('.')[0];
if (role !== 'bun_app') {
  console.error(`BUN_DATABASE_URL 사용자가 ${role} 입니다. bun_app 만 허용해서 접속하지 않았습니다.`);
  process.exit(1);
}
const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
if (!local && !process.argv.includes('--allow-remote')) {
  console.error('로컬 주소가 아니라서 멈췄습니다. 개발 프로젝트 확인은 --allow-remote 로 실행합니다.');
  process.exit(1);
}

async function main() {
  if (!url) return;
  const sql = postgres(url, {
    prepare: false,
    max: 1,
    connect_timeout: 5,
    ssl: url.includes('127.0.0.1') ? false : 'require',
  });

  try {
    const rows = await sql`select public.bun_get_board(1::smallint) as r`;
    const board = rows[0]?.r as { play_date?: string } | undefined;
    if (!board || typeof board !== 'object') throw new Error('board missing');
    console.log('bun_get_board ok', board.play_date ?? '');

    let blocked = false;
    try {
      await sql`select * from bun_scores`;
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code !== '42501') throw new Error('unexpected bun_scores error');
      blocked = true;
    }
    if (!blocked) throw new Error('bun_scores was readable');
    console.log('bun_scores blocked');
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'error';
  console.error('check-db failed', message);
  process.exit(1);
});
