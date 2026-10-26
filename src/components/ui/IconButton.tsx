import * as Tooltip from '@radix-ui/react-tooltip'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { iconButton } from './styles'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
}

// 아이콘 전용 버튼은 접근 가능한 이름과 호버, 포커스 툴팁을 함께 가진다.
const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton({ label, className = iconButton, children, ...props }, ref) {
  return <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <button ref={ref} type="button" aria-label={label} className={className} {...props}>{children}</button>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content side="bottom" sideOffset={6} collisionPadding={8} className="z-[2000] rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-md">
        {label}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
})

export default IconButton
