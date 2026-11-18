import raw from './wear-outfits.json';
import { daily } from '@/lib/daily';

export type WearGender = 'f' | 'm';
export type WearStyle = 'casual' | 'minimal' | 'street' | 'office' | 'active';
export type WearIconName = 'sleeveless' | 'tee' | 'shirt' | 'knit' | 'hoodie' | 'dress' | 'jacket' | 'coat' | 'pad';

export type WearBand = { id: number; min: number; max: number; label: string };
export type WearStyleMeta = { key: WearStyle; label: string };
export type WearGenderMeta = { key: WearGender; label: string };

export type WearOutfit = {
  id: string;
  gender: WearGender;
  band: number;
  style: WearStyle;
  main: string;
  extra: string;
  icon: WearIconName;
  items: [string, string, string];
};

const ICONS: WearIconName[] = ['sleeveless', 'tee', 'shirt', 'knit', 'hoodie', 'dress', 'jacket', 'coat', 'pad'];
const STYLE_KEYS: WearStyle[] = ['casual', 'minimal', 'street', 'office', 'active'];
const GENDER_KEYS: WearGender[] = ['f', 'm'];

type WearFile = {
  version: number;
  bands: WearBand[];
  styles: WearStyleMeta[];
  genders: WearGenderMeta[];
  icons: string[];
  count: number;
  outfits: WearOutfit[];
};

function isOutfit(item: WearOutfit): boolean {
  return (
    typeof item.id === 'string' &&
    /^[fm]\d{2}-(casual|minimal|street|office|active)$/.test(item.id) &&
    (item.gender === 'f' || item.gender === 'm') &&
    Number.isInteger(item.band) &&
    STYLE_KEYS.includes(item.style) &&
    typeof item.main === 'string' &&
    item.main.trim() !== '' &&
    typeof item.extra === 'string' &&
    item.extra.trim() !== '' &&
    ICONS.includes(item.icon) &&
    Array.isArray(item.items) &&
    item.items.length === 3 &&
    item.items.every((part) => typeof part === 'string' && part.trim() !== '') &&
    item.main === `${item.items[0]} + ${item.items[1]}` &&
    item.extra === item.items[2]
  );
}

/** 200개가 아니거나 (기온, 성별, 스타일)이 빠지거나 겹치면 빌드가 실패한다. 같은 기온·스타일의 여성/남성 코디가 같으면 실패한다. */
export function assertWearOutfits(file: WearFile): void {
  if (file.version !== 1 || file.count !== 200 || file.outfits.length !== 200) throw new Error('wear catalog count is invalid');
  if (file.bands.length !== 20 || file.styles.length !== 5 || file.genders.length !== 2) throw new Error('wear catalog axes are invalid');
  const seen = new Set<string>();
  for (const item of file.outfits) {
    const key = `${item.band}:${item.gender}:${item.style}`;
    if (!isOutfit(item) || seen.has(item.id) || seen.has(key)) throw new Error(`wear outfit is invalid: ${item?.id || '?'}`);
    seen.add(item.id);
    seen.add(key);
  }
  for (const band of file.bands) {
    if (!Number.isInteger(band.id) || !Number.isInteger(band.min) || !Number.isInteger(band.max) || band.min > band.max) throw new Error('wear band is invalid');
    for (const style of file.styles) {
      const women = file.outfits.find((item) => item.band === band.id && item.gender === 'f' && item.style === style.key);
      const men = file.outfits.find((item) => item.band === band.id && item.gender === 'm' && item.style === style.key);
      if (!women || !men || women.items.join('|') === men.items.join('|')) throw new Error(`wear pair is invalid: ${band.id} ${style.key}`);
    }
  }
}

const file = raw as WearFile;
assertWearOutfits(file);

export const wearBands = file.bands;
export const wearStyles = file.styles;
export const wearGenders = file.genders;
export const wearOutfits = file.outfits;

const byKey = new Map(wearOutfits.map((item) => [`${item.band}:${item.gender}:${item.style}`, item]));

export function wearBand(temp: number): WearBand {
  const rounded = Math.round(temp);
  return wearBands.find((band) => rounded >= band.min && rounded <= band.max) ?? (rounded >= 33 ? wearBands[0] : wearBands[wearBands.length - 1]);
}

export function wearOutfit(temp: number, gender: WearGender, style: WearStyle): WearOutfit {
  const band = wearBand(temp);
  const outfit = byKey.get(`${band.id}:${gender}:${style}`);
  if (!outfit) throw new Error(`wear outfit is missing: ${band.id} ${gender} ${style}`);
  return outfit;
}

/** 한 단계 추운 기온의 같은 성별·스타일. 가장 추운 단계에는 없다. */
export function colderOutfit(temp: number, gender: WearGender, style: WearStyle): WearOutfit | null {
  const next = wearBands.find((band) => band.id === wearBand(temp).id + 1);
  if (!next) return null;
  return byKey.get(`${next.id}:${gender}:${style}`) ?? null;
}

/** 스타일을 고르지 않은 날의 기본 스타일. 같은 날짜면 같은 값이다. */
export function wearStyleOfDay(date = new Date()): WearStyle {
  const index = Math.floor(daily(7, date)() * wearStyles.length);
  return wearStyles[index]?.key ?? 'casual';
}
