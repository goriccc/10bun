import { createHash } from 'node:crypto';
import { kstDateKey } from '@/lib/daily';

export function anonKey(device: string, salt: string, date = kstDateKey()): string {
  return createHash('sha256').update(`anon|${device}|${date}|${salt}`).digest('hex');
}

export function readSalt(): string | null {
  const salt = process.env.BUN_IP_SALT;
  if (!salt || salt.length < 32) return null;
  return salt;
}
