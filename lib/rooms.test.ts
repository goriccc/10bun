import { describe, expect, it } from 'vitest';
import { daysLeft, roomCodeOk, roomInvite, roomLink } from './rooms';

describe('room helpers', () => {
  it('accepts an 8 character code from the room alphabet', () => {
    expect(roomCodeOk('ABCDEFGH')).toBe(true);
    expect(roomCodeOk('K7Q2')).toBe(false);
    expect(roomCodeOk('ABCDEFG0')).toBe(false);
    expect(roomCodeOk('ABCDEFGI')).toBe(false);
  });

  it('counts remaining days from the expiry instant', () => {
    const now = Date.parse('2026-11-15T00:00:00+09:00');
    expect(daysLeft('2026-11-22T00:00:00+09:00', now)).toBe(7);
    expect(daysLeft('2026-11-15T01:00:00+09:00', now)).toBe(1);
    expect(daysLeft('2026-11-14T23:00:00+09:00', now)).toBe(0);
  });

  it('puts the room code on the invite link', () => {
    const link = roomLink('ABCD2345', 'copy', '2026-11-15');
    expect(link).toContain('/r/ABCD2345');
    expect(link).toContain('utm_campaign=room');
    expect(link).toContain('utm_content=20261115');
    expect(roomInvite('우리 팀', '오늘의 정확히 10초', 'ABCD2345')).toContain('우리 팀');
  });
});
