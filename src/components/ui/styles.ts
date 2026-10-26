// 같은 행에 놓이는 입력창과 버튼이 같은 외곽 높이를 쓰도록 높이 토큰을 한곳에서 정한다.
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
const buttonBase = `inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

export const button = {
  primary: `${buttonBase} h-11 px-4 text-[0.95rem] bg-accent text-white hover:bg-accent/90`,
  secondary: `${buttonBase} h-11 px-4 text-[0.95rem] bg-accent-soft text-accent hover:bg-accent-soft/70`,
  ghost: `${buttonBase} h-11 px-4 text-[0.95rem] bg-subtle text-ink hover:bg-line`,
  danger: `${buttonBase} h-11 px-4 text-[0.95rem] bg-neg-soft text-neg hover:bg-neg/15`,
  smallGhost: `${buttonBase} h-9 px-3 text-sm text-accent hover:bg-subtle`,
}

export const iconButton = `inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-subtle hover:text-ink ${focusRing}`

// 카드 안 삭제 아이콘: 붉은 아이콘, 호버 시 연한 붉은 배경
export const deleteIconButton = `inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-neg transition-colors hover:bg-neg-soft ${focusRing}`

export const input = 'block h-11 w-full rounded-xl border border-line bg-card px-3.5 text-base text-ink placeholder:text-muted focus:border-transparent focus:outline-2 focus:outline-accent aria-invalid:border-neg disabled:opacity-60'

export const label = 'flex flex-col gap-1.5 text-sm font-semibold text-muted'

export const card = 'rounded-2xl border border-line bg-card'

export const chip = (active: boolean) =>
  `inline-flex h-10 items-center rounded-full border px-4 text-[0.92rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
    active ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink hover:border-accent/40'
  }`

export const tabList = 'flex rounded-xl bg-subtle p-1'

export const tab = (active: boolean) =>
  `flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-[0.92rem] font-semibold transition-colors ${focusRing} ${
    active ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
  }`

export const sectionTitle = 'text-base font-bold text-ink'
