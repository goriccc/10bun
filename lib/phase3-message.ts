export function phaseMessage(code: string): string {
  switch (code) {
    case 'disabled':
      return '이 기능을 잠시 쉬고 있어요.';
    case 'closed':
      return '오늘은 마감됐어요.';
    case 'already':
      return '오늘은 이미 냈어요.';
    case 'dead':
      return '물고기가 떠났어요. 새 알을 부화시켜 주세요.';
    case 'no_attempts':
      return '오늘 줄 수 있는 먹이를 다 썼어요.';
    case 'too_fast':
      return '잠시 뒤에 다시 줄 수 있어요.';
    case 'bad_region':
      return '시도를 다시 골라 주세요.';
    case 'blocked':
      return '이 기기는 참여할 수 없어요.';
    case 'rate_limited':
      return '같은 네트워크에서 참여가 너무 많아요. 잠시 뒤에 다시 해 주세요.';
    default:
      return '지금은 저장하지 못했어요. 잠시 뒤에 다시 해 주세요.';
  }
}
