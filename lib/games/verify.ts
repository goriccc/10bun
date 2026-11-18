import { verify as verify10 } from './10sec';
import { verify as verifyColor } from './color';
import { verify as verifyDongne } from './dongne';
import { verify as verifyPrice } from './price';
import { verify as verifyShape } from './shape';
import { verify as verifyNumber } from './number';
import { verify as verifyPuzzle } from './puzzle';
import { verify as verifyReaction } from './reaction';

const checks: Record<number, (serverDate: string, score: number, meta: unknown) => { ok: true; score: number } | { ok: false }> = {
  1: verify10,
  2: verifyColor,
  3: (serverDate, score, meta) => verifyShape(score, meta, serverDate),
  4: verifyPrice,
  5: verifyDongne,
  6: verifyNumber,
  15: verifyPuzzle,
  17: (serverDate, score, meta) => {
    void serverDate;
    return verifyReaction(score, meta);
  },
};

export function verifyScore(
  gameId: number,
  serverDate: string,
  score: number,
  meta: unknown,
): { ok: true; score: number } | { ok: false } {
  const check = checks[gameId];
  if (!check) return { ok: false };
  return check(serverDate, score, meta);
}
