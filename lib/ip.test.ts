import { describe, expect, it } from 'vitest';
import { clientIpKey, ipHash, ipKey } from './ip';

describe('ip', () => {
  it('IPv6는 앞 64비트만 남긴다', () => {
    const a = ipKey('2001:db8:85a3:8d3:1319:8a2e:370:7348');
    const b = ipKey('2001:db8:85a3:8d3::9');
    const c = ipKey('2001:db8:85a3:9999::1');
    expect(a).toBe('2001:0db8:85a3:08d3');
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });

  it('IPv4 매핑 주소는 IPv4로 본다', () => {
    expect(ipKey('::ffff:203.0.113.8')).toBe('203.0.113.8');
  });

  it('전달된 주소의 첫 값만 해시한다', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' });
    expect(clientIpKey(headers)).toBe('198.51.100.4');
    const salt = '0123456789abcdef0123456789abcdef';
    const hash = ipHash('198.51.100.4', salt, '2026-11-14');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ipHash('198.51.100.4', salt + 'x', '2026-11-14')).not.toBe(hash);
    expect(clientIpKey(new Headers())).toBe('0.0.0.0');
  });
});
