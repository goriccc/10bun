/** 한국 시간 기준 날짜·시드. 목업 rng와 같은 난수를 쓰고, 날짜만 KST로 고정한다. */

export function kstDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function kstWeekday(d = new Date()): number {
  const [y, m, day] = kstDateKey(d).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

export function kstSeed(d = new Date()): number {
  const [y, m, day] = kstDateKey(d).split('-').map(Number);
  return y * 10000 + m * 100 + day;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function daily(salt: number, d = new Date()): () => number {
  return mulberry32(kstSeed(d) * 97 + salt * 7919);
}

export function shiftDateKey(key: string, days: number): string {
  const [y, m, day] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + days));
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${t.getUTCFullYear()}-${mm}-${dd}`;
}

export function kstHour(d = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }).format(d));
}

export function msUntilKstMidnight(d = new Date()): number {
  const next = shiftDateKey(kstDateKey(d), 1);
  return new Date(`${next}T00:00:00+09:00`).getTime() - d.getTime();
}

/** 'YYYY-MM-DD' 달력 날짜의 정오(KST). 시드용 Date로 쓴다. */
export function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00+09:00`);
}
