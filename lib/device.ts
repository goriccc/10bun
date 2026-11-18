const NICK_A = ['졸린', '재빠른', '수상한', '배고픈', '느긋한', '용감한', '엉뚱한', '조용한', '씩씩한', '반짝이는', '까칠한', '다정한'];
const NICK_B = ['수달', '판다', '펭귄', '너구리', '다람쥐', '부엉이', '고래', '오리', '두더지', '고양이', '카피바라', '미어캣'];

const NICK_RE = /^[가-힣a-zA-Z0-9]+( [가-힣a-zA-Z0-9]+)*$/;

export type DeviceProfile = {
  nickname: string;
  region: string;
};

/** 목업 별명 조합 중 서버가 받는 8자 이하만. */
export function defaultNicknames(): string[] {
  const out: string[] = [];
  for (const a of NICK_A) {
    for (const b of NICK_B) {
      const name = `${a} ${b}`;
      if (nicknameShapeOk(name)) out.push(name);
    }
  }
  return out;
}

export function nicknameShapeOk(name: string): boolean {
  return name.length >= 2 && name.length <= 8 && NICK_RE.test(name);
}

export function pickDefaultNickname(): string {
  const all = defaultNicknames();
  return all[Math.floor(Math.random() * all.length)] ?? '조용한 수달';
}

export function loadDeviceId(): string | null {
  try {
    const key = '10bun:device';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function loadProfile(): DeviceProfile | null {
  try {
    const raw = localStorage.getItem('10bun:profile');
    if (!raw) {
      const profile = { nickname: pickDefaultNickname(), region: '미정' };
      localStorage.setItem('10bun:profile', JSON.stringify(profile));
      return profile;
    }
    const parsed = JSON.parse(raw) as Partial<DeviceProfile>;
    if (typeof parsed.nickname !== 'string' || typeof parsed.region !== 'string') return null;
    return { nickname: parsed.nickname, region: parsed.region };
  } catch {
    return null;
  }
}

export function saveProfile(profile: DeviceProfile): boolean {
  try {
    localStorage.setItem('10bun:profile', JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
