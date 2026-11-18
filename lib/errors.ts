/** 화면 문구. API는 code만 돌려주고, 문장은 여기서 고른다. */
export const ERROR_TEXT = {
  disabled: '지금은 순위 기능을 잠시 쉬고 있어요. 연습으로 계속할 수 있어요.',
  no_attempts: '오늘 공식 도전을 다 썼어요. 0시에 다시 열려요.',
  rate_limited: '같은 네트워크에서 도전이 너무 많아요. 잠시 뒤에 다시 해 주세요.',
  blocked: '이 기기는 순위에 참여할 수 없어요.',
  expired: '도전 시간이 지났어요. 자정이 지나면 전날 도전은 제출되지 않아요.',
  invalid_score: '기록을 확인하지 못해 순위에 올리지 못했어요.',
  verify_failed: '기록을 확인하지 못해 순위에 올리지 못했어요.',
  review: '놀라운 기록이라 확인하고 있어요. 확인이 끝나면 순위에 들어가요.',
  bad_nickname: '별명은 2~8자 한글, 영문, 숫자로 정해 주세요.',
  bad_region: '시도를 다시 골라 주세요.',
  bad_game: '지금은 이 게임의 순위를 쉬고 있어요.',
  not_found: '기록을 저장하지 못했어요. 새로고침 후 다시 해 주세요.',
  already_submitted: '기록을 저장하지 못했어요. 새로고침 후 다시 해 주세요.',
  bad_request: '기록을 저장하지 못했어요. 새로고침 후 다시 해 주세요.',
  too_fast: '잠시 뒤에 다시 바꿔 주세요.',
  network: '연결이 불안정해요. 이번 판은 연습으로 기록돼요.',
} as const;

export type ErrorCode = keyof typeof ERROR_TEXT;

export function errorText(code: string): string {
  if (code in ERROR_TEXT) return ERROR_TEXT[code as ErrorCode];
  return ERROR_TEXT.bad_request;
}
