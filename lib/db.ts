import postgres from 'postgres';

const url = process.env.BUN_DATABASE_URL;
export const sql = url
  ? postgres(url, {
      prepare: false,
      // 로컬 next dev는 프로세스가 길어서 여유 있게, 서버리스는 슬롯을 아끼기.
      max: process.env.NODE_ENV === 'development' ? 6 : 3,
      idle_timeout: 20,
      connect_timeout: 5,
      ssl: url.includes('127.0.0.1') ? false : 'require',
    })
  : null;

if (!url && process.env.VERCEL_ENV === 'production') {
  throw new Error('BUN_DATABASE_URL missing in production');
}
