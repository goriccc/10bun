import { kstDateKey, shiftDateKey } from '@/lib/daily';

export type WearFacts = {
  temp: number;
  low: number;
  high: number;
  pop: number | null;
  hours: { hour: number; temp: number }[];
};

export type FcstItem = { category: string; fcstDate: string; fcstTime: string; fcstValue: string };

const SLOTS = [2, 5, 8, 11, 14, 17, 20, 23];
const CHART_HOURS = [6, 9, 12, 15, 18, 21];

/** 기상청 단기예보 격자. 위경도를 5km 격자로 바꾼다. */
export function gridOf(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877;
  const GRID = 5.0;
  const DEGRAD = Math.PI / 180;
  const re = RE / GRID;
  const slat1 = 30 * DEGRAD;
  const slat2 = 60 * DEGRAD;
  const olon = 126 * DEGRAD;
  const olat = 38 * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.pow(Math.tan(Math.PI * 0.25 + slat1 * 0.5), sn) * (Math.cos(slat1) / sn);
  let ro = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + olat * 0.5), sn);
  const ra = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5), sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5),
  };
}

function kstClock(now: Date): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const month = String(pick('month')).padStart(2, '0');
  const day = String(pick('day')).padStart(2, '0');
  return { date: `${pick('year')}-${month}-${day}`, hour: pick('hour'), minute: pick('minute') };
}

function slotTime(hour: number): string {
  return `${String(hour).padStart(2, '0')}00`;
}

/** 발표 시각(정각+10분) 이후의 최근 기준시각 3개. 아직 안 나온 발표는 빼 둔다. */
export function forecastBases(now = new Date()): { date: string; time: string }[] {
  const clock = kstClock(now);
  const ready = clock.hour * 60 + clock.minute;
  let date = clock.date;
  let slot = -1;
  for (const hour of SLOTS) {
    if (ready >= hour * 60 + 10) slot = hour;
  }
  if (slot < 0) {
    date = shiftDateKey(date, -1);
    slot = 23;
  }
  const out: { date: string; time: string }[] = [];
  for (let n = 0; n < 3; n += 1) {
    out.push({ date: date.replaceAll('-', ''), time: slotTime(slot) });
    const index = SLOTS.indexOf(slot);
    if (index <= 0) {
      date = shiftDateKey(date, -1);
      slot = 23;
    } else {
      slot = SLOTS[index - 1];
    }
  }
  return out;
}

function numberOf(rows: FcstItem[], category: string): number | null {
  const found = rows.find((row) => row.category === category);
  if (!found) return null;
  const value = Number(found.fcstValue);
  return Number.isFinite(value) ? value : null;
}

/** 오늘 예보 항목만 골라 현재 기온, 최저·최고, 강수확률, 시간대 기온을 만든다. */
export function readVillage(items: FcstItem[], now = new Date()): WearFacts | null {
  const today = kstDateKey(now).replaceAll('-', '');
  const hour = kstClock(now).hour;
  const rows = items.filter((item) => item.fcstDate === today);
  const temps = rows
    .filter((row) => row.category === 'TMP')
    .map((row) => ({ hour: Number(row.fcstTime.slice(0, 2)), temp: Number(row.fcstValue) }))
    .filter((row) => Number.isFinite(row.hour) && Number.isFinite(row.temp))
    .sort((a, b) => a.hour - b.hour);
  if (temps.length === 0) return null;
  const temp = temps.reduce((best, row) => (Math.abs(row.hour - hour) < Math.abs(best.hour - hour) ? row : best)).temp;
  const values = temps.map((row) => row.temp);
  const low = numberOf(rows, 'TMN') ?? Math.min(...values);
  const high = numberOf(rows, 'TMX') ?? Math.max(...values);
  const pops = rows.map((row) => (row.category === 'POP' ? Number(row.fcstValue) : Number.NaN)).filter((value) => Number.isFinite(value));
  const preferred = CHART_HOURS.flatMap((slot) => {
    const row = temps.find((item) => item.hour === slot);
    return row ? [row] : [];
  });
  return {
    temp,
    low,
    high,
    pop: pops.length > 0 ? Math.max(...pops) : null,
    hours: preferred.length > 0 ? preferred : temps,
  };
}

export function swingText(low: number, high: number): string {
  const gap = high - low;
  if (gap >= 8) return `일교차 ${gap}°. 아침에는 겉옷, 오후에는 벗기 쉬운 차림이 좋아요.`;
  return '일교차가 크지 않아요. 한 벌로 하루를 보내기 좋아요.';
}

export function chores(pop: number | null): { name: string; text: string; tone: 'ok' | 'warn' | 'bad' }[] | null {
  if (pop == null) return null;
  return [
    { name: '빨래', text: pop > 40 ? '오늘은 실내' : '잘 말라요', tone: pop > 40 ? 'bad' : 'ok' },
    { name: '세차', text: pop > 20 ? '내일로' : '좋은 날', tone: pop > 20 ? 'warn' : 'ok' },
    { name: '우산', text: pop > 40 ? `챙기세요 ${pop}%` : `필요 없음 ${pop}%`, tone: pop > 40 ? 'bad' : 'ok' },
  ];
}

/** 인코딩된 키를 한 번만 풀어 URL에 담는다. 키 값은 로그에 남기지 않는다. */
export function villageUrl(serviceKey: string, query: Record<string, string>): string {
  let decoded = serviceKey.trim();
  if (decoded.includes('%')) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      decoded = serviceKey.trim();
    }
  }
  const params = new URLSearchParams({ serviceKey: decoded, pageNo: '1', numOfRows: '1000', dataType: 'JSON', ...query });
  return `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?${params}`;
}
