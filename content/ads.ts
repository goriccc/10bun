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

/** CSS `.gadget` 강제 span과 동일. */
export const SHELF_SPAN_TWO_COL_MAX = 1000;
export const SHELF_SPAN_ONE_COL_MAX = 620;

/** 폴드 커버(접힘)보다 넓으면 펼침으로 본다. */
export const FOLD_UNFOLD_MIN = 380;

/** 삼성 Fold·Pixel Fold 등. */
export function isFoldPhoneUa(ua = ''): boolean {
  return /Fold|SM-F\d+|Pixel Fold/i.test(ua);
}

export type ShelfAdLayout = {
  /** 모바일 슬롯: 카드 N개마다 */
  moEvery: number;
  /**
   * PC 슬롯 줄 계산용 카드 span.
   * CSS와 맞춤: ≤1000 → 6(한 줄 2장), null이면 service.span 사용.
   */
  pcCardSpan: number | null;
};

/**
 * 선반 광고 간격.
 * - 폴드 세로 펼침(≤720·폭≥380): 모바일 광고 4개마다
 * - 그 외 모바일: 3개마다
 * - 가로·넓은 화면(>720): PC 광고, CSS와 같은 span으로 2줄마다(=≤1000이면 카드 4개마다)
 */
export function shelfAdLayout(width: number, fold: boolean): ShelfAdLayout {
  const moEvery = fold && width >= FOLD_UNFOLD_MIN && width <= AD_MOBILE_MAX ? 4 : 3;
  let pcCardSpan: number | null = null;
  if (width > AD_MOBILE_MAX) {
    if (width <= SHELF_SPAN_TWO_COL_MAX) pcCardSpan = 6;
    else pcCardSpan = null;
  }
  return { moEvery, pcCardSpan };
}
