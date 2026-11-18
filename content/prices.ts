import raw from './prices.json';

export type PriceItem = {
  id: string;
  name: string;
  unit: string;
  year: number;
  price: number;
  category: string;
  group: string;
  approx: boolean;
  source_url: string;
  source_name: string;
};

function valid(item: PriceItem): boolean {
  return (
    typeof item.id === 'string' &&
    /^p\d{3,}$/.test(item.id) &&
    typeof item.name === 'string' &&
    item.name.trim() !== '' &&
    typeof item.unit === 'string' &&
    item.unit.trim() !== '' &&
    Number.isInteger(item.year) &&
    item.year > 0 &&
    Number.isInteger(item.price) &&
    item.price > 0 &&
    typeof item.category === 'string' &&
    item.category.trim() !== '' &&
    typeof item.group === 'string' &&
    item.group.trim() !== '' &&
    typeof item.approx === 'boolean' &&
    typeof item.source_url === 'string' &&
    item.source_url.startsWith('https://') &&
    typeof item.source_name === 'string' &&
    item.source_name.trim() !== ''
  );
}

/** 필드 누락, 가격 0 이하, 출처 주소 없음, id 중복이면 빌드가 실패한다. */
export function assertPriceSources(items: PriceItem[]): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (!valid(item) || ids.has(item.id)) throw new Error(`price item is invalid: ${item?.id || '?'}`);
    ids.add(item.id);
  }
}

export const prices = raw as PriceItem[];

assertPriceSources(prices);
