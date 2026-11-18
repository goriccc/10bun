import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';

function readEnvFile(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync('.env.local')) return map;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx > 0) map.set(line.slice(0, idx), line.slice(idx + 1));
  }
  return map;
}

function writeEnvFile(map: Map<string, string>) {
  const body = [...map.entries()].map(([key, value]) => `${key}=${value}`).join('\n');
  writeFileSync('.env.local', body + '\n');
}

function secret(): string {
  return randomBytes(24).toString('base64url');
}

const env = readEnvFile();
if (!env.get('BUN_IP_SALT') || (env.get('BUN_IP_SALT') ?? '').length < 32) env.set('BUN_IP_SALT', secret());
if (!env.get('BUN_DATABASE_URL')) {
  env.set('BUN_DATABASE_URL', `postgresql://bun_app:${secret()}@127.0.0.1:54322/postgres`);
}
if (!env.has('NEXT_PUBLIC_SITE_URL')) env.set('NEXT_PUBLIC_SITE_URL', 'https://10bun.com');
if (!env.has('NEXT_PUBLIC_ADSENSE_CLIENT')) env.set('NEXT_PUBLIC_ADSENSE_CLIENT', '');
if (!env.has('NEXT_PUBLIC_GA_ID')) env.set('NEXT_PUBLIC_GA_ID', '');
writeEnvFile(env);

const dbUrl = env.get('BUN_DATABASE_URL') ?? '';
const parsed = new URL(dbUrl);
if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
  console.error('로컬 주소가 아니라서 멈췄습니다.');
  process.exit(1);
}
if (parsed.username !== 'bun_app') {
  console.error('사용자는 bun_app 이어야 합니다.');
  process.exit(1);
}
const password = decodeURIComponent(parsed.password);
if (password.length < 32 || password.includes("'") || password.includes('\\')) {
  console.error('로컬 비밀번호 형식이 맞지 않습니다.');
  process.exit(1);
}

const admin = postgres(`postgresql://postgres:postgres@${parsed.hostname}:${parsed.port || '54322'}/postgres`, {
  max: 1,
  ssl: false,
  connect_timeout: 5,
});

try {
  await admin.unsafe(`alter role bun_app with login password '${password}'`);
  await admin`alter role bun_app connection limit 20`;
  await admin`alter role bun_app set statement_timeout = '3s'`;
  await admin`alter role bun_app set idle_in_transaction_session_timeout = '10s'`;
  await admin`create extension if not exists pg_cron`;
  await admin.unsafe(readFileSync('supabase/manual/02_bun_cron.sql', 'utf8'));
  console.log('local role and cron applied');
} catch (err) {
  const message = err instanceof Error ? err.message : 'error';
  console.error('local bootstrap failed', message.replaceAll(password, '[redacted]'));
  process.exitCode = 1;
} finally {
  await admin.end({ timeout: 1 });
}
