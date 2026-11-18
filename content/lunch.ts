export const LUNCH_BUDGETS = ['1만원 이하', '1만 5천원', '2만원 이상'] as const;

export const LUNCH_MENUS: Record<(typeof LUNCH_BUDGETS)[number], string[]> = {
  '1만원 이하': ['김치찌개', '제육볶음', '국밥', '칼국수', '김밥+라면', '비빔밥', '짜장면', '돈가스'],
  '1만 5천원': ['부대찌개', '쌀국수', '초밥 정식', '냉면', '감자탕', '마라탕', '카레', '순두부'],
  '2만원 이상': ['삼겹살', '샤브샤브', '파스타', '스테이크 덮밥', '회덮밥', '곱창', '양꼬치', '갈비탕'],
};

export const WHEEL_COLORS = ['#FF5E5B', '#FFD13D', '#4B5BFF', '#2DCEA2', '#FF8BC6', '#8C6BFF', '#FF9A3D', '#231D4B'];
