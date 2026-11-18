import { kstDateKey } from './daily';

export function loadDone(key = kstDateKey()): number[] {
  try {
    const raw = localStorage.getItem(`10bun:done:${key}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

export function markDone(id: number, key = kstDateKey()): void {
  try {
    const ids = loadDone(key);
    if (!ids.includes(id)) ids.push(id);
    localStorage.setItem(`10bun:done:${key}`, JSON.stringify(ids));
  } catch {
    /* 저장소를 못 써도 놀이는 계속된다 */
  }
}
