import sidoFile from '@/content/dongne-sido.json';
import sggFile from '@/content/dongne-sgg.json';
import { dailyPick, todayDongne } from '@/lib/games/dongne';

type ShapeItem = { code: string; label: string; lat: number; lng: number; path: string };
type ShapeFile = { viewBox: string; count: number; items: ShapeItem[] };

const shapes = sggFile as ShapeFile;
const sidos = sidoFile as ShapeFile;
const easyCache = new Map<string, ShapeItem>();

export type DongneSpot = { code: string; label: string; lat: number; lng: number };

/** 페이지에 내리는 오늘 실루엣. 다른 날의 path는 포함하지 않는다. */
export type DongneDay = {
  code: string;
  path: string;
  easyCode: string;
  easyPath: string;
  sidos: DongneSpot[];
};

if (shapes.viewBox !== '0 0 200 200' || shapes.count !== 229) throw new Error('dongne shape');
if (sidos.viewBox !== '0 0 200 200' || sidos.count !== 17) throw new Error('dongne sido');

/** 시·도 쉬운 모드. 17개라 최근 10일만 피한다. */
export function todaySido(dateKey: string): ShapeItem {
  return dailyPick(dateKey, 8, sidos.items, 10, easyCache);
}

export function todayDongneView(dateKey: string): DongneDay {
  const day = todayDongne(dateKey);
  const shape = shapes.items.find((item) => item.code === day.code);
  const easy = todaySido(dateKey);
  if (!shape?.path || !easy.path) throw new Error('dongne shape missing');
  return {
    code: day.code,
    path: shape.path,
    easyCode: easy.code,
    easyPath: easy.path,
    sidos: sidos.items.map((item) => ({ code: item.code, label: item.label, lat: item.lat, lng: item.lng })),
  };
}
