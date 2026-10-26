import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Modal } from './Modal/Modal'
import { errorMessage } from '../lib/errors'
import { button } from './ui/styles'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = '삭제',
  onConfirm,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      // 실패하면 창을 그대로 두어 다시 시도하거나 취소할 수 있게 한다.
      toast.error(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen
      size="sm"
      draggable={false}
      title={title}
      initialFocusRef={cancelRef}
      onClose={() => { if (!busy) onClose() }}
      footer={<>
        <button ref={cancelRef} type="button" className={button.ghost} disabled={busy} onClick={onClose}>취소</button>
        <button type="button" className={button.danger} disabled={busy} onClick={() => void confirm()}>{busy ? '처리 중…' : confirmLabel}</button>
      </>}
    >
      <p className="m-0 leading-relaxed text-ink">{message}</p>
    </Modal>
  )
}
