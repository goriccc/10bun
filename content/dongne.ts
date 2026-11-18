import indexFile from './dongne-index.json';

export type DongnePlace = {
  code: string;
  label: string;
  name: string;
  sido_short: string;
  lat: number;
  lng: number;
};

type IndexFile = {
  credit: string;
  count: number;
  items: DongnePlace[];
};

const file = indexFile as IndexFile;

function assertIndex(items: DongnePlace[]): void {
  if (items.length !== 229) throw new Error('dongne index count');
  const labels = new Set<string>();
  const codes = new Set<string>();
  for (const item of items) {
    if (!/^\d{5}$/.test(item.code)) throw new Error('dongne code');
    if (!item.label || labels.has(item.label) || codes.has(item.code)) throw new Error('dongne label');
    if ('path' in item) throw new Error('dongne path');
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) throw new Error('dongne point');
    labels.add(item.label);
    codes.add(item.code);
  }
}

assertIndex(file.items);

/** 결과 화면에 그대로 적는다. */
export const DONGNE_CREDIT = '자료: 국가데이터처 센서스 경계(2025.06)';

if (file.credit !== DONGNE_CREDIT || file.count !== file.items.length) throw new Error('dongne credit');

export const dongnePlaces: DongnePlace[] = file.items;

const byLabel = new Map(dongnePlaces.map((item) => [item.label, item]));
const byCode = new Map(dongnePlaces.map((item) => [item.code, item]));

export function dongneByLabel(label: string): DongnePlace | undefined {
  return byLabel.get(label);
}

export function dongneByCode(code: string): DongnePlace | undefined {
  return byCode.get(code);
}
