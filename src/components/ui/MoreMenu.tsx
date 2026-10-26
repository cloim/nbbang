import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Ellipsis } from 'lucide-react'
import type { ReactNode } from 'react'
import IconButton from './IconButton'

export interface MoreMenuItem {
  label: string
  icon: ReactNode
  onSelect: () => void
  danger?: boolean
}

// 페이지 단위의 드문 작업(이름 변경, 삭제)을 상단바 오른쪽 더보기 메뉴에 모은다.
// 파괴적 작업은 구분선으로 떼어 놓는다.
export default function MoreMenu({ label, items }: { label: string; items: MoreMenuItem[] }) {
  const safe = items.filter((item) => !item.danger)
  const danger = items.filter((item) => item.danger)
  const itemClass = 'flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm font-semibold outline-none data-[highlighted]:bg-subtle'
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <IconButton label={label}><Ellipsis size={20} aria-hidden="true" /></IconButton>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} className="z-[1500] min-w-44 rounded-xl border border-line bg-card p-1.5 shadow-lg">
        {safe.map((item) => <DropdownMenu.Item key={item.label} className={`${itemClass} text-ink`} onSelect={item.onSelect}>{item.icon}{item.label}</DropdownMenu.Item>)}
        {safe.length > 0 && danger.length > 0 && <DropdownMenu.Separator className="my-1 h-px bg-line" />}
        {danger.map((item) => <DropdownMenu.Item key={item.label} className={`${itemClass} text-neg data-[highlighted]:bg-neg-soft`} onSelect={item.onSelect}>{item.icon}{item.label}</DropdownMenu.Item>)}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
}
