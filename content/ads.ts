/** 애드센스 수동 광고 단위. 값은 공개 슬롯 ID. */
export const AD_SLOTS = {
  moHomeLive: '1665562077',
  moHomeChamps: '4410932888',
  moHomeShelf: '8962045272',
  moDetailRank: '8427245697',
  pcHomeStart: '8299700293',
  pcHomeChamps: '2252719580',
  pcHomeShelf: '2227622671',
  pcDetailRank: '6986618621',
  pcDetailGuide: '4488447791',
} as const;

export type AdSlotId = (typeof AD_SLOTS)[keyof typeof AD_SLOTS];

/** 홈·상세 광고 분기. CSS hero 모바일 기준과 맞춤. */
export const AD_MOBILE_MAX = 720;
