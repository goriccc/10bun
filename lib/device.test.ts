import { describe, expect, it } from 'vitest';
import { defaultNicknames, nicknameShapeOk } from './device';

const BANNED = ['관리자', '운영자', 'admin', '10분닷컴', '공식'];

describe('default nicknames', () => {
  it('8자 이하 조합만 남고 별명 규칙을 통과한다', () => {
    const names = defaultNicknames();
    expect(names).toHaveLength(143);
    expect(names).not.toContain('반짝이는 카피바라');
    for (const name of names) {
      expect(nicknameShapeOk(name)).toBe(true);
      const flat = name.replaceAll(' ', '').toLowerCase();
      for (const word of BANNED) expect(flat.includes(word.toLowerCase())).toBe(false);
    }
  });
});
