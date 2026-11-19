/** 애드센스 수동 광고 단위. 값은 공개 슬롯 ID. */
export const AD_SLOTS = {
  moHomeLive: '1665562077',
  moHomeChamps: '4410932888',
  moHomeShelf: '8962045272',
  moDetailRank: '8427245697',
  pcHomeChamps: '2252719580',
  pcHomeShelf: '2227622671',
  pcDetailRank: '6986618621',
  pcDetailGuide: '4488447791',
} as const;

export type AdSlotId = (typeof AD_SLOTS)[keyof typeof AD_SLOTS];

/** 홈·상세 광고 분기. CSS hero 모바일 기준과 맞춤. */
export const AD_MOBILE_MAX = 720;

/** 폴드 세로 펼침으로 보는 최소 CSS 폭(일반 폰보다 넓고 PC 분기 이하). */
export const FOLD_UNFOLD_MIN = 500;

/** 삼성 Fold·Pixel Fold 등 폴드 계열 UA. */
export function isFoldPhoneUa(ua = ''): boolean {
  return /Fold|SM-F\d{3,4}|Pixel Fold/i.test(ua);
}

/** 모바일 선반 광고 간격. 폴드 세로 펼침만 4개마다, 그 외 모바일은 3개마다. */
export function moShelfAdEvery(width: number, fold: boolean): number {
  if (fold && width >= FOLD_UNFOLD_MIN && width <= AD_MOBILE_MAX) return 4;
  return 3;
}
