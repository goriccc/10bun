import raw from './wear-points.json';

export type WearSpot = {
  code: string;
  sido: string;
  name: string;
  nx: number;
  ny: number;
};

type WearPointFile = {
  source: string;
  sidos: string[];
  defaults: Record<string, string>;
  points: WearSpot[];
};

const SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

function valid(item: WearSpot, sidos: Set<string>): boolean {
  return (
    typeof item.code === 'string' &&
    /^\d{10}$/.test(item.code) &&
    sidos.has(item.sido) &&
    typeof item.name === 'string' &&
    item.name.trim() !== '' &&
    Number.isInteger(item.nx) &&
    item.nx >= 1 &&
    item.nx <= 149 &&
    Number.isInteger(item.ny) &&
    item.ny >= 1 &&
    item.ny <= 253
  );
}

/** 시·도 17개, 시·군·구 코드가 빠지거나 겹치면 빌드가 실패한다. */
export function assertWearPoints(file: WearPointFile): void {
  if (file.source.trim() === '' || file.sidos.join('|') !== SIDO.join('|') || file.points.length < 200) throw new Error('wear point catalog is invalid');
  const sidos = new Set(file.sidos);
  const codes = new Set<string>();
  for (const item of file.points) {
    if (!valid(item, sidos) || codes.has(item.code)) throw new Error(`wear point is invalid: ${item?.code || '?'}`);
    codes.add(item.code);
  }
  for (const sido of file.sidos) {
    const code = file.defaults[sido];
    const point = file.points.find((item) => item.code === code);
    if (!point || point.sido !== sido) throw new Error(`wear default is invalid: ${sido}`);
    if (!file.points.some((item) => item.sido === sido)) throw new Error(`wear sido is empty: ${sido}`);
  }
}

const file = raw as WearPointFile;
assertWearPoints(file);

export const wearPointSource = file.source;
export const wearSidos = file.sidos;
export const wearSpots = file.points;

const byCode = new Map(wearSpots.map((item) => [item.code, item]));

export function wearSpot(code: string): WearSpot | undefined {
  return byCode.get(code);
}

export function wearSpotsIn(sido: string): WearSpot[] {
  return wearSpots.filter((item) => item.sido === sido);
}

export function wearDefault(sido: string): WearSpot | undefined {
  const code = file.defaults[sido];
  return code ? byCode.get(code) : undefined;
}
