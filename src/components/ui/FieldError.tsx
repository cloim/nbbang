import * as Popover from '@radix-ui/react-popover'
import type { ReactNode } from 'react'

interface Props {
  id: string
  message?: string
  className?: string
  children: ReactNode
}

// 필드 오류는 레이아웃을 밀지 않도록 필드에 붙는 오버레이로 띄운다.
// 입력 요소에는 호출하는 쪽에서 aria-invalid와 aria-describedby={id}를 연결한다.
export default function FieldError({ id, message, className, children }: Props) {
  return <Popover.Root open={Boolean(message)}>
    <Popover.Anchor asChild><div className={className}>{children}</div></Popover.Anchor>
    <Popover.Portal>
      <Popover.Content
        id={id}
        role="alert"
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        hideWhenDetached
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="z-[2000] max-w-[min(320px,calc(100vw-16px))] rounded-lg border border-neg/30 bg-card px-3 py-2 text-sm font-medium text-neg shadow-lg"
      >
        {message}
        <Popover.Arrow className="fill-card" />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
}
