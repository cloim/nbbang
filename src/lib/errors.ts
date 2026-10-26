const FALLBACK = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'

// 사용자에게는 다음 행동을 알 수 있는 문구만 보여주고, 원문은 개발자 도구에 남긴다.
export function errorMessage(error: unknown): string {
  console.error(error)
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return '서버에 연결하지 못했어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.'
  // 코드 오류(TypeError 등)의 원문은 사용자에게 의미가 없으므로 일반 안내로 바꾼다.
  if (error instanceof Error && error.constructor === Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return FALLBACK
}
