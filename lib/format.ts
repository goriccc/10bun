export function formatScore(gameId: number, score: number): string {
  if (gameId === 1) return `${score.toFixed(3)}초`;
  if (gameId === 2 || gameId === 3) return `${score.toFixed(2)}점`;
  if (gameId === 4) return `${Math.round(score).toLocaleString('ko-KR')}점`;
  if (gameId === 5) {
    const tries = Math.floor(score / 1000);
    const sec = Math.round(score % 1000);
    if (tries >= 7) return '실패';
    return `${tries}번 ${sec}초`;
  }
  if (gameId === 6) return `${Math.round(score)}초`;
  if (gameId === 15) {
    const m = Math.floor(score / 60);
    const s = (score % 60).toFixed(2);
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  }
  if (gameId === 17) return `${Math.round(score)}ms`;
  return String(score);
}

export function gapText(gameId: number, mine: number, cutoff: number): string {
  if (gameId === 1) return `${Math.max(0, mine - cutoff).toFixed(3)}초`;
  if (gameId === 2 || gameId === 3) return `${Math.max(0, cutoff - mine).toFixed(2)}점`;
  if (gameId === 4) return `${Math.max(0, Math.round(cutoff - mine)).toLocaleString('ko-KR')}점`;
  if (gameId === 5) {
    const gap = Math.max(0, Math.round(mine - cutoff));
    const tries = Math.floor(gap / 1000);
    const sec = gap % 1000;
    if (tries > 0) return `${tries}번 ${sec}초`;
    return `${Math.max(1, sec)}초`;
  }
  if (gameId === 6) return `${Math.max(1, Math.round(mine - cutoff))}초 단축`;
  return `${Math.max(1, Math.round(mine - cutoff))}ms`;
}

export function kstClock(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
