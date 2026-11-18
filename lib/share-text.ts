import type { Service } from '@/content/services';
import { dateShort } from '@/lib/share';

export function inviteShareText(service: Service): string {
  return `[오늘의 ${service.title}] ${service.line}\n${service.time}이면 끝나요`;
}

export function puzzleResultShareText(n: number, score: number, moves: number, key?: string): string {
  const m = Math.floor(score / 60);
  const s = (score % 60).toFixed(2);
  const time = m > 0 ? `${m}분 ${s}초` : `${s}초`;
  return `오늘의 슬라이드 퍼즐 ${dateShort(key)} (${n}×${n})\n${time}, ${moves}번 이동`;
}
