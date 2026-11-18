import { createHash } from 'node:crypto';
import { kstDateKey } from './daily';

/** x-forwarded-for 첫 값, 없으면 x-real-ip, 없으면 0.0.0.0. IPv6는 /64만 남긴다. */
export function clientIpKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  const raw = first || headers.get('x-real-ip')?.trim() || '0.0.0.0';
  return ipKey(raw);
}

export function ipKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '0.0.0.0';
  if (trimmed.includes(':')) return ipv6Prefix64(trimmed);
  return trimmed;
}

export function ipHash(key: string, salt: string, date = kstDateKey()): string {
  return createHash('sha256').update(`${key}|${date}|${salt}`).digest('hex');
}

function ipv6Prefix64(raw: string): string {
  const noZone = raw.split('%')[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(noZone);
  if (mapped) return mapped[1];
  return expandIPv6(noZone).split(':').slice(0, 4).join(':');
}

function expandIPv6(addr: string): string {
  const lower = addr.toLowerCase();
  const halves = lower.split('::');
  if (halves.length > 2) return zeroAddr();
  if (halves.length === 1) {
    const groups = lower.split(':');
    if (groups.length !== 8) return zeroAddr();
    return groups.map(pad4).join(':');
  }
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return zeroAddr();
  const zeros = Array.from({ length: missing }, () => '0000');
  return [...head.map(pad4), ...zeros, ...tail.map(pad4)].join(':');
}

function pad4(group: string): string {
  return group.padStart(4, '0');
}

function zeroAddr(): string {
  return '0000:0000:0000:0000:0000:0000:0000:0000';
}
